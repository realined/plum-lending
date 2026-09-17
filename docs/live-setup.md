# Live account setup — required acceptance gate

Start with [Phase 0 findings and gates](phase-0-setup-checklist.md). The owner has now selected an existing job-search/BenTech Gmail account for synthetic-only use, superseding new-mailbox creation. Use [the mailbox isolation settings](mailbox-isolation.md) and a new free HubSpot instance. Never access unrelated correspondence or other personal accounts. The owner requested guided setup, with manual handoffs for personal details, secrets, MFA/recovery, CAPTCHA, legal acceptance and OAuth consent. Do not open account pages until the inspection checklist has been delivered. Creating configuration does not authorize the agent to connect or ingest. No credentials belong in chat, screenshots, source control, logs, or the source archive.

Current checkpoint: the dedicated Cloud project is created and Gmail API is enabled. OAuth registration is in External/Testing mode; the sole approved test user and Gmail read-only scope are saved. The owner reports the Web client was created and its credentials saved privately. Presence-only checks verify both credential fields, the exact callback, expected mailbox, seed-only settings and file permissions; actual Google consent/callback has now passed, and the saved profile matches the approved mailbox. Free HubSpot onboarding is complete, with automatic email/contact sync skipped. The single-line text `contact_type` property exists. The owner created the private app with five read scopes and saved its token locally. The real adapter authentication check passed for contacts, Sponsor property, companies, deals and pipelines; the existing connection function then revalidated and encrypted the token into the local database, and the live UI shows Connected. Account identity, associations and ingestion still require verification. The private local `.env` now exists with generated security values; fill provider fields in that existing file instead of rerunning setup. The owner installed Docker Desktop. PostgreSQL 17.11 is healthy on loopback, migrations 1 and 2 are applied, and the live web app and separate worker are verified. The live UI shows both Gmail and HubSpot Connected, with no completed ingestion. Seed writes remain pending; see the offline [dataset and permission proposal](seed-plan.md). The full configuration check reports missing `OPENAI_API_KEY`; this blocks interpretation, not database setup or Gmail consent, and no paid call is authorized.

## 1. Local runtime and database

Use Node.js 22 LTS or newer and pnpm. On the owner's current workstation, the verified bundled Node/pnpm binaries are available for this terminal session with:

```sh
export PATH="/Users/leebennett/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
node --version
pnpm --version
```

This changes only the current shell's tool lookup. On another machine, install Node 22+ and pnpm 11.19+ normally. Docker/PostgreSQL are not currently installed on the verified local PATH; install and start Docker Desktop or supply an existing PostgreSQL 17 database before proceeding.

From `/Users/leebennett/Projects/plum-lending`:

```sh
cd /Users/leebennett/Projects/plum-lending
pnpm install --frozen-lockfile
pnpm setup:live
```

The setup command writes `.env` with permissions `0600`, fresh independent administrator/session/encryption values, `APP_MODE=live`, and the local Compose database address. It refuses to overwrite an existing `.env` and prints no generated values. If `.env` already exists, edit it in your local editor; preserve its encryption key to keep existing tokens decryptable.

Start Docker Desktop, then:

```sh
docker compose up -d postgres
```

Alternatively use an existing PostgreSQL 17 database and set `DATABASE_URL` locally. Native PostgreSQL/Docker was not available in the original coding environment; it is required for the real-account worker. The Compose database is bound to loopback. Its published development password is not suitable for a shared or public database.

## 2. Google Cloud and the dedicated test Gmail account

1. In [Google Cloud Console](https://console.cloud.google.com/), create/select a dedicated POC project owned by the approved account. Enable **Gmail API** in APIs & Services → Library.
2. Configure **Google Auth Platform / OAuth consent screen**. Choose External for a personal Gmail account (or Internal only if eligible for your Workspace organization). Set an app name and support/developer email.
3. For an external test app, keep Publishing status **Testing** and add the approved Gmail address as a **test user** under Audience. Add the data-access scope `https://www.googleapis.com/auth/gmail.readonly`.
4. Create an OAuth client with application type **Web application**. Add exactly this authorized redirect URI: `http://localhost:3000/api/connections/gmail/callback`.
5. Copy the client ID and client secret into your local `.env` fields `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Do not use a service-account key or paste a Gmail password.
6. Keep `APP_URL=http://localhost:3000` and `GOOGLE_REDIRECT_URI=http://localhost:3000/api/connections/gmail/callback` configured exactly as shown. Use the `localhost` URL in the browser, not `127.0.0.1`, because mutation origin checks are exact.
7. Set `LENDER_ALIASES` only if the connected mailbox has other addresses it owns that should count as lender recipients. Separate addresses with commas; leave blank otherwise. The primary mailbox address is read from Gmail's profile endpoint and must match `GMAIL_EXPECTED_MAILBOX`.

The app handles consent, PKCE, state validation, authorization-code exchange, encrypted refresh-token storage, and refresh automatically. Do not manually create access/refresh tokens. Testing-mode Google grants with these scopes generally have a seven-day refresh-token lifetime; reconnect for an expired test grant. Gmail read-only is a restricted scope; public production distribution has additional verification requirements. [Google OAuth server flow](https://developers.google.com/identity/protocols/oauth2/web-server), [token expiration](https://developers.google.com/identity/protocols/oauth2#expiration).

## 3. Free HubSpot CRM account

1. Create a new [free HubSpot CRM account](https://www.hubspot.com/products/crm) using the approved Gmail address. Use a Super Admin account to manage private apps.
2. In current HubSpot navigation, go to **Development → Legacy apps → Create legacy app → Private**. Some account interfaces may still show private apps under Settings → Integrations.
3. Name it `BenTech Lending Lab Reader` and use the existing documented read-scope set below. Verify endpoint permissions during Phase 3 and remove any redundant schema grants if object-read scopes suffice; no working minimum grant is yet proven against an account: `crm.objects.contacts.read`, `crm.objects.companies.read`, `crm.objects.deals.read`, `crm.schemas.contacts.read`, and `crm.schemas.deals.read`.
4. The owner clicks Create app and completes any final confirmation, then copies its token directly into `/Users/leebennett/Projects/plum-lending/.env` as `HUBSPOT_PRIVATE_APP_TOKEN`, in a private local editor. Pause tool observation before creating or revealing the token. The owner saves the file, closes the token screen and returns to the Legacy Apps list before reporting completion. Never paste the token into this conversation.
5. In HubSpot Settings → Properties, select Contact properties. Create a single-line text property with internal name `contact_type` without creating seed records yet. The approved seeder will later set fictional contacts to `Sponsor`. Alternatively configure `HUBSPOT_SPONSOR_PROPERTY` and `HUBSPOT_SPONSOR_VALUE` to the **internal name/value** of a suitable existing field. Labels and internal values may differ for dropdowns. The app validates that the property exists.
6. The owner selected the supported environment-token path for this phase. After creating the Sponsor property and saving the token locally, explicitly run `pnpm hubspot:check` with the owner's authorization. This reuses the read-only adapter validation independently of Gmail, the seed receipt, PostgreSQL and OpenAI. It performs five GET checks (contacts/property/companies/deals/pipelines), limits object-list checks to one record and discards response content. It prints fixed outcomes only and exits nonzero on failure. It does not create records, persist a connection, or prove account identity/associations/full ingestion. Do not run it with an unrelated CRM token.
7. The automatic environment-token bootstrap persists the application connection when a live export starts, not on app startup or `config:check`; a successful `hubspot:check` does not by itself make the UI connected. The masked UI connection form validates and persists immediately as an alternative. During guided setup, the operator explicitly invoked the existing `connectHubSpot` server function with the privately loaded environment token after migrations; it revalidated and encrypted the connection without an export. The live UI was then verified. Remove the environment token when disconnecting to prevent reconnection on a later run.

The validation step checks contact, company, and deal reads plus the Sponsor property and deal pipelines. No write scope is needed. [Official private-app instructions](https://developers.hubspot.com/docs/apps/legacy-apps/private-apps/overview), [scope reference](https://developers.hubspot.com/docs/apps/legacy-apps/authentication/scopes).

The observed creation wizard labels private apps as legacy, says existing functionality still works with limited future support, and recommends Service Keys for newer integrations. Retain the implemented private-app flow for this acceptance baseline. Evaluating a different credential mechanism is a later migration decision, not proof that the current integration has passed.

## 4. OpenAI interpretation

Live interpretation requires an API key in `OPENAI_API_KEY`, entered locally by the owner. API usage is metered: first resolve the owner's no-charges instruction; do not create billing/subscriptions or make paid calls. `OPENAI_MODEL=gpt-4.1-mini` is the default and can be changed to an available model supporting Responses structured output. No cost arrangement has been approved. See [API pricing](https://developers.openai.com/api/docs/pricing).

Only the segmentation query is sent, with `store:false`. The system sends no Gmail bodies or CRM records. Do not put sensitive correspondence or unnecessary identifying information in the query. [Structured output reference](https://developers.openai.com/api/docs/guides/structured-outputs).

## 5. Required `.env` values

| Field | What you supply |
| --- | --- |
| `APP_MODE` | `live` |
| `APP_URL` | `http://localhost:3000` |
| `DATABASE_URL` | Local Compose value, or your private PostgreSQL URL |
| `EMBEDDED_WORKER` | `false` |
| `ADMIN_PASSWORD` | Generated by setup; read in your local editor for signing in |
| `SESSION_SECRET` | Generated; leave private and stable |
| `TOKEN_ENCRYPTION_KEY` | Generated base64 encoding of exactly 32 bytes; leave private and stable |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Web application OAuth client credentials |
| `GOOGLE_REDIRECT_URI` | The exact URI registered above |
| `GMAIL_EXPECTED_MAILBOX` | Owner-approved address; compared to the OAuth profile |
| `GMAIL_DATA_SCOPE` | `seed-only`; never use `mailbox` for this account |
| `GMAIL_SEED_MANIFEST_PATH` | `.data/live-seed/manifest.json`, written by the future approved seeder |
| `LENDER_ALIASES` | Optional owned aliases only |
| `HUBSPOT_PRIVATE_APP_TOKEN` | Owner enters private-app token locally |
| `HUBSPOT_SPONSOR_PROPERTY` / `HUBSPOT_SPONSOR_VALUE` | `contact_type` / `Sponsor`, or confirmed internal mapping |
| `OPENAI_API_KEY` | Your project API key |
| `OPENAI_MODEL` | A structured-output capable model available to your project |

After setup, edit `.env` in a local editor. The provider fields you fill look like this (these are placeholders, never real credentials):

```dotenv
GOOGLE_CLIENT_ID=<your web OAuth client ID>
GOOGLE_CLIENT_SECRET=<your web OAuth client secret>
GOOGLE_REDIRECT_URI=http://localhost:3000/api/connections/gmail/callback
GMAIL_EXPECTED_MAILBOX=<owner-approved Gmail address>
GMAIL_DATA_SCOPE=seed-only
GMAIL_SEED_MANIFEST_PATH=.data/live-seed/manifest.json
OPENAI_API_KEY=<your project API key>
OPENAI_MODEL=gpt-4.1-mini
HUBSPOT_SPONSOR_PROPERTY=contact_type
HUBSPOT_SPONSOR_VALUE=Sponsor
HUBSPOT_PRIVATE_APP_TOKEN=<your private-app token>
LENDER_ALIASES=
```

Keep the generated administrator/session/encryption values. Fill values only in the private file, without angle brackets; the HubSpot token remains private in this file and must be validated before seeding.

Do not print `.env` to verify it. The configuration checker reports missing **field names only**:

```sh
pnpm config:check
pnpm db:migrate
pnpm build
pnpm start
```

In a second terminal in the same directory:

```sh
pnpm worker
```

In Connections → Live account setup, verify that the worker heartbeat is recent. Configuration flags describe presence/shape, not verified provider access.

The web and worker processes load the same `.env` file. Restart both after configuration changes. Never run a separate worker against PGlite's demo directory.

## 6. Manual checkpoints and live seed approval

Use the built-in browser for guided account setup. The owner performs security prompts, private entry, legal acceptance and OAuth consent; never observe or capture secret values. Confirm that the selected account is the owner-approved job-search/BenTech mailbox before proceeding with the actual app connection. The expected-mailbox check must pass and `seed-only` must remain enabled. No other personal mailbox is allowed.

The app remains read-only. The separate Phase 4 seeder is implemented and tested offline; its writer credentials, live account preflight and actual writes remain pending. Follow the exact separate `.env.seed`, OAuth callback and scope instructions in [seed-plan.md](seed-plan.md). The owner selected insert/read/labels and retained-mail cleanup. Wait for explicit approval of the proposed dataset before writes. Do not send emails. `pnpm sample` only creates offline examples and does not seed live services.

After seeding, follow [live-acceptance.md](live-acceptance.md) using the seed manifest, then report the measured baseline before proposing refinements. The current workflow performs snapshot ingestion within each export job; it has no separate Sync button. No deployment or publication occurs in these phases.
