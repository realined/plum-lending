import { config } from "../src/server/config";
try {
  const c = config();
  const fields =
    c.mode === "live"
      ? [
          "DATABASE_URL",
          "ADMIN_PASSWORD",
          "SESSION_SECRET",
          "TOKEN_ENCRYPTION_KEY",
          "GOOGLE_CLIENT_ID",
          "GOOGLE_CLIENT_SECRET",
          "GOOGLE_REDIRECT_URI",
          "OPENAI_API_KEY",
        ]
      : [];
  const missing = fields.filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(`Missing field names only: ${missing.join(", ")}`);
    process.exitCode = 1;
  } else
    console.info(
      `Configuration shape is valid for ${c.mode}. Credential correctness and live access have not been tested.`,
    );
} catch {
  console.error(
    "Configuration is invalid. Review docs/live-setup.md. No credential values are printed.",
  );
  process.exitCode = 1;
}
