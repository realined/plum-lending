import { z } from "zod";
export function config() {
  const mode = z.enum(["demo", "live"]).parse(process.env.APP_MODE ?? "demo");
  const appUrl = new URL(process.env.APP_URL ?? "http://localhost:3000");
  if (mode === "live") {
    if (!/^postgres(?:ql)?:\/\//.test(process.env.DATABASE_URL ?? ""))
      throw new Error("Live mode requires DATABASE_URL.");
    if (
      (process.env.ADMIN_PASSWORD?.length ?? 0) < 24 ||
      (process.env.SESSION_SECRET?.length ?? 0) < 32
    )
      throw new Error(
        "Live mode requires ADMIN_PASSWORD (24+ characters) and SESSION_SECRET (32+).",
      );
    if (
      Buffer.from(process.env.TOKEN_ENCRYPTION_KEY ?? "", "base64").length !==
      32
    )
      throw new Error("Live mode requires a 32-byte TOKEN_ENCRYPTION_KEY.");
    if (
      appUrl.protocol !== "https:" &&
      !["localhost", "127.0.0.1"].includes(appUrl.hostname)
    )
      throw new Error("Non-local live deployments require HTTPS.");
  }
  return {
    mode,
    appUrl: appUrl.origin,
    embeddedWorker: process.env.EMBEDDED_WORKER
      ? process.env.EMBEDDED_WORKER === "true"
      : mode === "demo",
  };
}
