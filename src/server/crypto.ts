import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
function key() {
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY ?? "", "base64");
  if (key.length !== 32) throw new Error("TOKEN_KEY_REQUIRED");
  return key;
}
export function encryptToken(value: string): string {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from("plum-token-v1"));
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}
export function decryptToken(value: string): string {
  const [version, iv, tag, body] = value.split(".");
  if (version !== "v1" || !iv || !tag || !body) throw new Error("TOKEN_FORMAT");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAAD(Buffer.from("plum-token-v1"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(body, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
