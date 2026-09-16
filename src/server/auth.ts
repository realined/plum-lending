import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { config } from "./config";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function constantEqual(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function signSession(exp = Date.now() + 8 * 60 * 60 * 1000) {
  const body = String(exp);
  const sig = createHmac("sha256", process.env.SESSION_SECRET ?? "")
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}
export function authenticated(req: NextRequest) {
  if (config().mode === "demo") return true;
  const cookie = req.cookies.get("plum_session")?.value;
  if (!cookie) return false;
  const [exp] = cookie.split(".");
  return (
    Number(exp) > Date.now() && constantEqual(cookie, signSession(Number(exp)))
  );
}
export function requireAuth(req: NextRequest) {
  if (!authenticated(req))
    throw new HttpError(401, "Sign in to access your workspace.");
}
export function requireOrigin(req: NextRequest) {
  if (req.headers.get("origin") !== config().appUrl)
    throw new HttpError(
      403,
      "Request origin is not allowed. Open the configured APP_URL.",
    );
}
export const cookieOptions = () => ({
  httpOnly: true,
  secure: config().appUrl.startsWith("https:"),
  sameSite: "lax" as const,
  path: "/",
  maxAge: 8 * 60 * 60,
});
export async function readBody(req: NextRequest) {
  if (!req.headers.get("content-type")?.includes("application/json"))
    throw new HttpError(415, "JSON content is required.");
  if (Number(req.headers.get("content-length") ?? 0) > 12000)
    throw new HttpError(413, "Request is too large.");
  const text = await req.text();
  if (Buffer.byteLength(text) > 12000)
    throw new HttpError(413, "Request is too large.");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(400, "Invalid JSON request.");
  }
}
