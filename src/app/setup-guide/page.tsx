import Link from "next/link";

export const metadata = { title: "Live setup guide · Plum" };

export default function SetupGuide() {
  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: "0 24px 60px", lineHeight: 1.8 }}>
      <Link href="/?view=connections">← Back to Connections</Link>
      <h1>Live account setup</h1>
      <p>Connect your own Gmail and a free HubSpot CRM, then verify the complete ingestion and CSV flow. Keep credentials in your local environment file, never in chat or source control.</p>
      <section><h2>1. Prepare the local application</h2>
        <p>Use Node.js 22 or newer, pnpm 11.19 or newer, and PostgreSQL 17. Run these commands from the project folder:</p>
        <pre>{"pnpm install --frozen-lockfile\npnpm setup:live\ndocker compose up -d postgres"}</pre>
        <p>The setup command creates a private <code>.env</code> and refuses to overwrite an existing file. Edit that file locally. Keep <code>APP_MODE=live</code>, <code>APP_URL=http://localhost:3000</code>, and <code>EMBEDDED_WORKER=false</code>. Preserve the generated encryption key so existing tokens remain readable. Configure <code>DATABASE_URL</code> for your database.</p>
      </section>
      <section><h2>2. Configure Gmail OAuth</h2>
        <ol>
          <li>In Google Cloud Console, select your project and enable the Gmail API.</li>
          <li>Configure Google Auth Platform branding and audience. For an external testing app, add your approved Gmail account as a test user.</li>
          <li>Add the read-only scope <code>https://www.googleapis.com/auth/gmail.readonly</code>.</li>
          <li>Create a Web application OAuth client with redirect URI <code>http://localhost:3000/api/connections/gmail/callback</code>.</li>
          <li>Save its credentials privately in <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code>. Set <code>GOOGLE_REDIRECT_URI</code> to the same callback.</li>
        </ol>
        <p>Use localhost consistently, not 127.0.0.1, for this application. Set <code>GMAIL_EXPECTED_MAILBOX</code> to the approved account. Configure <code>LENDER_ALIASES</code> only for additional addresses that mailbox owns.</p>
        <p>For a mixed-use mailbox, retain the project’s seed-only configuration and private receipt of approved message identifiers. Gmail OAuth is mailbox-wide; isolation is enforced by the application. A label alone does not authorize unrelated messages. Follow <code>docs/mailbox-isolation.md</code> in the local source folder before ingestion.</p>
      </section>
      <section><h2>3. Configure HubSpot</h2>
        <p>Create a free CRM instance. Create a private app with read scopes for contacts, companies and deals, plus contact and deal schema read access. Save its token in <code>HUBSPOT_PRIVATE_APP_TOKEN</code> or enter it in the app’s private connection dialog.</p>
        <p>Confirm the configured Sponsor contact property and internal value match your CRM. The challenge uses <code>contact_type</code> and <code>Sponsor</code>. Deal eligibility uses directly associated deals whose current stage is Closed Won. Closed Lost does not exclude a contact.</p>
        <p>The application reader needs no write scopes. The separately authorized seed writer is a development tool and uses separate credentials.</p>
      </section>
      <section><h2>4. Configure interpretation and start</h2>
        <p>Save <code>OPENAI_API_KEY</code> privately for live natural-language interpretation. Only the segmentation request is sent to the model; CRM records and email bodies are not sent through that path.</p>
        <pre>{"pnpm config:check\npnpm db:migrate\npnpm build\npnpm start\n# In a second terminal with the same configuration:\npnpm worker"}</pre>
        <p>Sign in with your local <code>ADMIN_PASSWORD</code>. On Connections, connect Gmail through Google consent and validate HubSpot. Restart the web app and worker after environment changes. Configuration checks and a worker heartbeat do not establish that provider ingestion succeeded.</p>
      </section>
      <section><h2>5. Verify an export</h2>
        <p>Use only approved test data. In Audience builder, interpret a request, review the exact criteria, and run the segment. Inspect the completed result and its exclusions, open a full thread, and download the CSV. One row represents one contact–thread pair. Confirm expected contact, thread and message counts.</p>
        <p>Mocks help automated tests; successful live OAuth, HubSpot access, ingestion, normalization and a downloaded CSV prove the live flow.</p>
      </section>
      <section><h2>Data removal and disconnecting</h2>
        <p><strong>Delete data</strong> removes saved requests, run history, normalized CRM/email records and stored exports from this app’s database. Connections remain available. It does not delete Gmail messages, HubSpot records or CSV files already downloaded to your computer.</p>
        <p><strong>Disconnect &amp; delete</strong> also removes the selected provider’s stored connection credentials and clears derived workspace data. Gmail disconnect attempts to revoke the Google grant. For HubSpot, revoke the private-app token in HubSpot and remove any bootstrap token from your environment file. Neither action deletes source messages or CRM records.</p>
        <p>The separate seed cleanup command has its own approval and cleanup policy; it is not triggered by either UI action.</p>
      </section>
      <p>For detailed operator procedures, see <code>docs/live-setup.md</code>, <code>docs/mailbox-isolation.md</code> and <code>docs/security.md</code> in the local project folder.</p>
    </main>
  );
}
