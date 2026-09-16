import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
// This writes generated secrets directly to the ignored local file. No secret output.
const values: Record<string, string> = {
  APP_MODE: "live",
  EMBEDDED_WORKER: "false",
  ADMIN_PASSWORD: randomBytes(24).toString("base64url"),
  SESSION_SECRET: randomBytes(32).toString("base64url"),
  TOKEN_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  DATABASE_URL: "postgresql://plum:local-development-only@localhost:5432/plum",
};
try {
  const template = await readFile(".env.example", "utf8");
  const contents = template.replace(/^([A-Z_]+)=.*$/gm, (line, name: string) =>
    name in values ? `${name}=${values[name]}` : line,
  );
  await writeFile(".env", contents, { flag: "wx", mode: 0o600 });
  console.info(
    "Created private .env with generated local security values. Open it in your editor and fill the provider fields. No accounts were contacted.",
  );
} catch {
  console.error(
    "Setup did not write .env. If it already exists, edit it locally; this command never overwrites it.",
  );
  process.exitCode = 1;
}
