import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "./database";
import { decryptToken, encryptToken } from "./crypto";
import { GmailProvider } from "@/providers/gmail";
import { HubSpotProvider } from "@/providers/hubspot";
import { fetchJson } from "@/providers/http";
import { uniqueEmails } from "@/domain/identity";
const tokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_at: z.number(),
});
export const googleResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number(),
  scope: z.string().optional(),
});
export async function saveConnection(
  provider: string,
  token: string,
  mailbox?: string,
) {
  await (
    await db()
  ).query(
    "INSERT INTO connections(id,provider,status,encrypted_token,mailbox,generation) VALUES($1,$1,'connected',$2,$3,$4)",
    [provider, encryptToken(token), mailbox ?? null, randomUUID()],
  );
}
export async function googleAccessToken(expectedGeneration?: string) {
  const d = await db();
  const [row] = await d.query<{ encrypted_token: string; generation: string }>(
    "SELECT encrypted_token,generation FROM connections WHERE id='gmail' AND status='connected'",
  );
  if (!row) throw new Error("GMAIL_NOT_CONNECTED");
  if (expectedGeneration && row.generation !== expectedGeneration)
    throw new Error("CONNECTION_CHANGED");
  const token = tokenSchema.parse(
    JSON.parse(decryptToken(row.encrypted_token)),
  );
  if (token.expires_at > Date.now() + 60000) return token.access_token;
  const refreshed = googleResponseSchema.parse(
    await fetchJson(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID ?? "",
          client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
          refresh_token: token.refresh_token,
          grant_type: "refresh_token",
        }),
      },
      false,
    ),
  );
  const next = {
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token ?? token.refresh_token,
    expires_at: Date.now() + refreshed.expires_in * 1000,
  };
  const updated = await d.query(
    "UPDATE connections SET encrypted_token=$1 WHERE id='gmail' AND encrypted_token=$2 AND status='connected' RETURNING id",
    [encryptToken(JSON.stringify(next)), row.encrypted_token],
  );
  if (!updated.length) {
    const [current] = await d.query<{
      encrypted_token: string;
      generation: string;
    }>(
      "SELECT encrypted_token,generation FROM connections WHERE id='gmail' AND status='connected'",
    );
    if (!current || current.generation !== row.generation)
      throw new Error("CONNECTION_CHANGED");
    const refreshedByPeer = tokenSchema.parse(
      JSON.parse(decryptToken(current.encrypted_token)),
    );
    if (refreshedByPeer.expires_at <= Date.now() + 60000)
      throw new Error("TOKEN_REFRESH_CONFLICT");
    return refreshedByPeer.access_token;
  }
  return next.access_token;
}
export async function connectHubSpot(token: string) {
  const provider = new HubSpotProvider(
    token,
    process.env.HUBSPOT_SPONSOR_PROPERTY,
    process.env.HUBSPOT_SPONSOR_VALUE,
  );
  await provider.validateConnection();
  await saveConnection("hubspot", token);
}
export async function liveProviders() {
  const d = await db();
  let rows = await d.query<{
    id: string;
    encrypted_token: string;
    mailbox: string | null;
    generation: string;
  }>(
    "SELECT id,encrypted_token,mailbox,generation FROM connections WHERE status='connected'",
  );
  if (
    !rows.some((r) => r.id === "hubspot") &&
    process.env.HUBSPOT_PRIVATE_APP_TOKEN
  ) {
    await connectHubSpot(process.env.HUBSPOT_PRIVATE_APP_TOKEN);
    rows = await d.query(
      "SELECT id,encrypted_token,mailbox,generation FROM connections WHERE status='connected'",
    );
  }
  const gmail = rows.find((r) => r.id === "gmail"),
    hubspot = rows.find((r) => r.id === "hubspot");
  if (!gmail?.mailbox || !hubspot) throw new Error("CONNECT_PROVIDERS_FIRST");
  const lenders = uniqueEmails([
    gmail.mailbox,
    ...(process.env.LENDER_ALIASES ?? "").split(",").filter(Boolean),
  ]);
  return {
    email: new GmailProvider(
      () => googleAccessToken(gmail.generation),
      lenders,
    ),
    crm: new HubSpotProvider(
      decryptToken(hubspot.encrypted_token),
      process.env.HUBSPOT_SPONSOR_PROPERTY,
      process.env.HUBSPOT_SPONSOR_VALUE,
    ),
    lenders,
  };
}
export async function revokeGoogle() {
  const [row] = await (
    await db()
  ).query<{ encrypted_token: string }>(
    "SELECT encrypted_token FROM connections WHERE id='gmail' AND status='connected'",
  );
  if (!row) return true;
  const token = tokenSchema.parse(
    JSON.parse(decryptToken(row.encrypted_token)),
  );
  try {
    const res = await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: token.refresh_token }),
      signal: AbortSignal.timeout(15000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
