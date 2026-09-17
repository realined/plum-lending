import { config } from "../src/server/config";
import { gmailAccessConfig } from "../src/server/gmail-access";
try {
  const c = config();
  if (c.mode === "live") gmailAccessConfig();
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
          "GMAIL_EXPECTED_MAILBOX",
          "OPENAI_API_KEY",
        ]
      : [];
  const missing = fields.filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(`Missing field names only: ${missing.join(", ")}`);
    process.exitCode = 1;
  } else if (
    c.mode === "live" &&
    process.env.GOOGLE_REDIRECT_URI !==
      `${c.appUrl}/api/connections/gmail/callback`
  ) {
    console.error(
      "GOOGLE_REDIRECT_URI must exactly equal the APP_URL origin followed by /api/connections/gmail/callback.",
    );
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
