import { createServer } from "node:http";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { encryptToken } from "@/server/crypto";
import { SeedError, SEED_DIRECTORY, writePrivate } from "./private-files";

export const SEED_CALLBACK = "http://127.0.0.1:3001/seed/callback";
export const SEED_START = "http://127.0.0.1:3001/seed/start";
export const SEED_GMAIL_SCOPES = [
  "gmail.insert",
  "gmail.readonly",
  "gmail.labels",
].map((scope) => `https://www.googleapis.com/auth/${scope}`);
export type SeedOAuthConfig = {
  clientId: string;
  clientSecret: string;
  readerClientId: string;
  mailbox: string;
};
export function seedAuthorizationUrl(
  config: SeedOAuthConfig,
  state: string,
  verifier: string,
) {
  if (
    !config.clientId ||
    !config.clientSecret ||
    config.clientId === config.readerClientId ||
    !z.email().safeParse(config.mailbox).success
  )
    throw new SeedError("SEED_SEPARATE_OAUTH_CLIENT_REQUIRED");
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: SEED_CALLBACK,
    response_type: "code",
    scope: SEED_GMAIL_SCOPES.join(" "),
    access_type: "online",
    include_granted_scopes: "false",
    prompt: "consent",
    login_hint: config.mailbox,
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}
export async function exchangeSeedCode(
  config: SeedOAuthConfig,
  code: string,
  verifier: string,
) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: SEED_CALLBACK,
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(30_000),
    redirect: "error",
  });
  if (!response.ok) throw new SeedError("SEED_OAUTH_EXCHANGE_FAILED");
  const token = z
    .object({
      access_token: z.string().min(1),
      expires_in: z.number().positive(),
      scope: z.string(),
    })
    .parse(await response.json());
  const scopes = token.scope.split(" ").filter(Boolean);
  if (
    scopes.length !== SEED_GMAIL_SCOPES.length ||
    !SEED_GMAIL_SCOPES.every((scope) => scopes.includes(scope))
  )
    throw new SeedError("SEED_OAUTH_SCOPE_MISMATCH");
  const profileResponse = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/profile?fields=emailAddress",
    {
      headers: { Authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(30_000),
      redirect: "error",
    },
  );
  if (!profileResponse.ok) throw new SeedError("SEED_OAUTH_PROFILE_FAILED");
  const profile = z
    .object({ emailAddress: z.email() })
    .parse(await profileResponse.json());
  if (profile.emailAddress.toLowerCase() !== config.mailbox)
    throw new SeedError("SEED_GMAIL_ACCOUNT_MISMATCH");
  return {
    clientId: config.clientId,
    mailbox: config.mailbox,
    expiresAt: Date.now() + token.expires_in * 1000,
    encryptedToken: encryptToken(token.access_token),
  };
}
export async function authorizeSeedWriter(config: SeedOAuthConfig) {
  const state = randomBytes(32).toString("base64url"),
    verifier = randomBytes(48).toString("base64url");
  const authorizationUrl = seedAuthorizationUrl(config, state, verifier);
  const equal = (value: string) =>
    value.length === state.length &&
    timingSafeEqual(Buffer.from(value), Buffer.from(state));
  await new Promise<void>((resolve, reject) => {
    let started = false,
      finishing = false;
    let outcome: "success" | "failure" | undefined;
    const server = createServer(async (request, response) => {
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Referrer-Policy", "no-referrer");
      response.setHeader(
        "Content-Security-Policy",
        "default-src 'none'; frame-ancestors 'none'",
      );
      let url: URL;
      try {
        url = new URL(request.url ?? "/", SEED_START);
      } catch {
        response.writeHead(400).end("Invalid local request.");
        return;
      }
      if (
        request.headers.host !== "127.0.0.1:3001" ||
        request.method !== "GET"
      ) {
        response.writeHead(400).end("Invalid local request.");
        return;
      }
      if (url.pathname === "/seed/start" && !started) {
        started = true;
        response.setHeader(
          "Set-Cookie",
          `plum_seed_state=${state}; HttpOnly; SameSite=Lax; Path=/seed; Max-Age=600`,
        );
        response.writeHead(302, { Location: authorizationUrl }).end();
        return;
      }
      if (url.pathname === "/seed/done" && outcome) {
        response
          .writeHead(outcome === "success" ? 200 : 400, {
            "Content-Type": "text/plain",
          })
          .end(
            outcome === "success"
              ? "Separate seed authorization saved privately. You can close this tab. No email or CRM records were created."
              : "Seed authorization failed. No private values are displayed. Close this tab and review setup.",
          );
        clearTimeout(timer);
        server.close(() =>
          outcome === "success"
            ? resolve()
            : reject(new SeedError("SEED_OAUTH_FAILED")),
        );
        return;
      }
      if (url.pathname !== "/seed/callback" || finishing) {
        response.writeHead(404).end("Not found.");
        return;
      }
      finishing = true;
      try {
        const cookie =
          request.headers.cookie
            ?.split(";")
            .map((part) => part.trim())
            .find((part) => part.startsWith("plum_seed_state="))
            ?.slice("plum_seed_state=".length) ?? "";
        const code = url.searchParams.get("code");
        if (
          !started ||
          !equal(cookie) ||
          !equal(url.searchParams.get("state") ?? "") ||
          !code ||
          url.searchParams.has("error")
        )
          throw new SeedError("SEED_OAUTH_STATE_FAILED");
        const saved = await exchangeSeedCode(config, code, verifier);
        await writePrivate(`${SEED_DIRECTORY}/writer-token.json`, saved);
        response.setHeader(
          "Set-Cookie",
          "plum_seed_state=; HttpOnly; SameSite=Lax; Path=/seed; Max-Age=0",
        );
        outcome = "success";
        response.writeHead(303, { Location: "/seed/done" }).end();
      } catch {
        outcome = "failure";
        response.writeHead(303, { Location: "/seed/done" }).end();
      }
    });
    const timer = setTimeout(() => {
      server.close();
      reject(new SeedError("SEED_OAUTH_TIMED_OUT"));
    }, 600_000);
    server.on("error", () => {
      clearTimeout(timer);
      reject(new SeedError("SEED_OAUTH_PORT_UNAVAILABLE"));
    });
    server.listen(3001, "127.0.0.1", () => {
      console.info(
        `Owner consent required: open ${SEED_START}. No secrets or authorization URLs are logged.`,
      );
    });
  });
}
