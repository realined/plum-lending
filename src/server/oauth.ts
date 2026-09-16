import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { encryptToken, decryptToken } from "./crypto";
import { config } from "./config";
import { HttpError, constantEqual, cookieOptions } from "./auth";
import { fetchJson } from "@/providers/http";
import { GmailProvider } from "@/providers/gmail";
import { googleResponseSchema, saveConnection } from "./connections";
const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
function oauthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID,
    clientSecret = process.env.GOOGLE_CLIENT_SECRET,
    redirect = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirect)
    throw new HttpError(
      400,
      "Configure Google OAuth client ID, secret, and redirect URI in .env first.",
    );
  if (redirect !== `${config().appUrl}/api/connections/gmail/callback`)
    throw new HttpError(
      400,
      "Google redirect URI must match APP_URL/api/connections/gmail/callback exactly.",
    );
  return { clientId, clientSecret, redirect };
}
export function startOAuth() {
  const c = oauthConfig(),
    state = randomBytes(32).toString("base64url"),
    verifier = randomBytes(48).toString("base64url");
  const params = new URLSearchParams({
    client_id: c.clientId,
    redirect_uri: c.redirect,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  });
  const res = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
  );
  res.cookies.set(
    "plum_oauth",
    encryptToken(
      JSON.stringify({ state, verifier, expires: Date.now() + 600000 }),
    ),
    { ...cookieOptions(), path: "/api/connections/gmail", maxAge: 600 },
  );
  return res;
}
export async function finishOAuth(req: NextRequest) {
  const finish = (status: string) => {
    const res = NextResponse.redirect(
      `${config().appUrl}/?connection=${status}`,
    );
    res.cookies.set("plum_oauth", "", {
      ...cookieOptions(),
      path: "/api/connections/gmail",
      maxAge: 0,
    });
    return res;
  };
  try {
    const c = oauthConfig(),
      cookie = req.cookies.get("plum_oauth")?.value;
    if (!cookie) return finish("oauth-failed");
    const saved = z
      .object({ state: z.string(), verifier: z.string(), expires: z.number() })
      .parse(JSON.parse(decryptToken(cookie)));
    const state = req.nextUrl.searchParams.get("state") ?? "",
      code = req.nextUrl.searchParams.get("code");
    if (
      saved.expires <= Date.now() ||
      !constantEqual(state, saved.state) ||
      req.nextUrl.searchParams.has("error") ||
      !code
    )
      return finish("oauth-failed");
    const token = googleResponseSchema.parse(
      await fetchJson(
        "https://oauth2.googleapis.com/token",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: c.clientId,
            client_secret: c.clientSecret,
            redirect_uri: c.redirect,
            grant_type: "authorization_code",
            code,
            code_verifier: saved.verifier,
          }),
        },
        false,
      ),
    );
    if (!token.refresh_token || !token.scope?.split(" ").includes(SCOPE))
      return finish("oauth-failed");
    const provider = new GmailProvider(async () => token.access_token, []);
    const profile = await provider.validateConnection();
    await saveConnection(
      "gmail",
      JSON.stringify({
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at: Date.now() + token.expires_in * 1000,
      }),
      profile.mailbox,
    );
    return finish("gmail-connected");
  } catch {
    return finish("oauth-failed");
  }
}
