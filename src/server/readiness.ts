import { gmailAccessConfig } from "./gmail-access";

export type SetupCheck = {
  id: string;
  label: string;
  configured: boolean;
  detail: string;
};

// Local configuration shape only. This function never reads provider data or returns values.
export function setupChecks(): SetupCheck[] {
  const e = process.env;
  let gmailScope: "seed-only" | "mailbox" | undefined;
  try {
    gmailScope = gmailAccessConfig().scope;
  } catch {
    /* Configuration only; do not read the manifest or provider data here. */
  }
  let redirectMatches = false;
  try {
    redirectMatches =
      new URL(e.GOOGLE_REDIRECT_URI ?? "").href ===
      `${new URL(e.APP_URL ?? "http://localhost:3000").origin}/api/connections/gmail/callback`;
  } catch {
    /* Missing or malformed URLs are shown as not configured. */
  }
  return [
    {
      id: "database",
      label: "PostgreSQL database",
      configured: /^postgres(?:ql)?:\/\//.test(e.DATABASE_URL ?? ""),
      detail:
        "A PostgreSQL connection is required for live data and the separate worker.",
    },
    {
      id: "security",
      label: "Administrator and encryption settings",
      configured:
        (e.ADMIN_PASSWORD?.length ?? 0) >= 24 &&
        (e.SESSION_SECRET?.length ?? 0) >= 32 &&
        Buffer.from(e.TOKEN_ENCRYPTION_KEY ?? "", "base64").length === 32,
      detail:
        "Generate local settings with pnpm setup:live. Keep the encryption key stable.",
    },
    {
      id: "google",
      label: "Google OAuth application",
      configured: Boolean(
        e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET && redirectMatches,
      ),
      detail:
        "Register the Gmail callback URL, add yourself as a test user, and configure the client credentials locally.",
    },
    {
      id: "gmail-data",
      label: "Gmail data scope",
      configured: Boolean(gmailScope),
      detail:
        gmailScope === "mailbox"
          ? "Mailbox scope is selected: this can retrieve real correspondence. Do not use it for the interview account."
          : "Test-data-only scope: an approved mailbox and seeder receipt are required. The receipt is validated before each run; real messages must never be added to it.",
    },
    {
      id: "openai",
      label: "OpenAI interpretation",
      configured: Boolean(e.OPENAI_API_KEY?.trim()),
      detail:
        "Provide an API key locally. Only your segmentation request goes to the model.",
    },
  ];
}
