# Live account setup — required acceptance gate

Do this only after the owner approves connecting the accounts. Creating configuration does not authorize the agent to connect or ingest. No credentials belong in chat, screenshots, source control, logs, or the source archive.

## 1. Local runtime and database

Use Node.js 22 LTS or newer and pnpm. From the repository:

```sh
pnpm install --frozen-lockfile
pnpm setup:live
```

The setup command writes `.env` with permissions `0600`, fresh independent administrator/session/encryption values, `APP_MODE=live`, and the local Compose database address. It refuses to overwrite an existing `.env` and prints no generated values. If `.env` already exists, edit it in your local editor; preserve its encryption key to keep existing tokens decryptable.

Start Docker Desktop, then:

```sh
docker compose up -d postgres
```

Alternatively use an existing PostgreSQL 17 database and set `DATABASE_URL` locally. Native PostgreSQL/Docker was not available in the original coding environment; it is required for the real-account worker. The Compose database is bound to loopback. Its published development password is not suitable for a shared or public database.

## 2. Google Cloud and your Gmail account

1. In [Google Cloud Console](https://console.cloud.google.com/), create/select a project you own. Enable **Gmail API** in APIs & Services → Library.
2. Configure **Google Auth Platform / OAuth consent screen**. Choose External for a personal Gmail account (or Internal only if eligible for your Workspace organization). Set an app name and support/developer email.
3. For an external test app, keep Publishing status **Testing** and add your own Gmail address as a **test user** under Audience. Add the data-access scope `https://www.googleapis.com/auth/gmail.readonly`.
4. Create an OAuth client with application type **Web application**. Add exactly this authorized redirect URI: `http://localhost:3000/api/connections/gmail/callback`.
5. Copy the client ID and client secret into your local `.env` fields `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Do not use a service-account key or paste a Gmail password.
6. Keep `APP_URL=http://localhost:3000` and `GOOGLE_REDIRECT_URI=http://localhost:3000/api/connections/gmail/callback` identical in origin. Use the `localhost` URL in the browser, not `127.0.0.1`, because mutation origin checks are exact.
7. Set `LENDER_ALIASES` only if the connected mailbox has other addresses it owns that should count as lender recipients. Separate addresses with commas; leave blank otherwise. The primary mailbox address is read from Gmail's profile endpoint.

The app handles consent, PKCE, state validation, authorization-code exchange, encrypted refresh-token storage, and refresh automatically. Do not manually create access/refresh tokens. Testing-mode Google grants with these scopes generally have a seven-day refresh-token lifetime; reconnect for an expired test grant. Gmail read-only is a restricted scope; public production distribution has additional verification requirements. [Google OAuth server flow](https://developers.google.com/identity/protocols/oauth2/web-server), [token expiration](https://developers.google.com/identity/protocols/oauth2#expiration).

## 3. Free HubSpot CRM account

1. Create/sign into a [free HubSpot CRM account](https://www.hubspot.com/products/crm). Use a Super Admin account to manage private apps.
2. In current HubSpot navigation, go to **Development → Legacy apps → Create legacy app → Private**. Some account interfaces may still show private apps under Settings → Integrations.
3. Name it `Plum interview POC` and select these read scopes: `crm.objects.contacts.read`, `crm.objects.companies.read`, `crm.objects.deals.read`, `crm.schemas.contacts.read`, and `crm.schemas.deals.read`.
4. Create the app. In its **Auth** tab, copy its access token into a local password manager temporarily. It will be entered into the local application's masked HubSpot connection field. Never paste it into this conversation.
5. In HubSpot Settings → Properties, select Contact properties. Create a single-line text property with internal name `contact_type` and set desired contacts to `Sponsor`. Alternatively configure `HUBSPOT_SPONSOR_PROPERTY` and `HUBSPOT_SPONSOR_VALUE` to the **internal name/value** of a suitable existing field. Labels and internal values may differ for dropdowns. The app validates that the property exists.
6. Keep `HUBSPOT_PRIVATE_APP_TOKEN` blank when using the connection form. An optional bootstrap environment token is supported for operator-controlled setup, but it must be removed when disconnecting to prevent reconnection on a later authorized run.

The validation step checks contact, company, and deal reads plus the Sponsor property and deal pipelines. No write scope is needed. [Official private-app instructions](https://developers.hubspot.com/docs/apps/legacy-apps/private-apps/overview), [scope reference](https://developers.hubspot.com/docs/apps/legacy-apps/authentication/scopes).

## 4. OpenAI interpretation

Create an API key in your own OpenAI project and place it in `OPENAI_API_KEY` locally. `OPENAI_MODEL=gpt-4.1-mini` is the default and can be changed to an available model supporting Responses structured output. Billing and model access belong to your account.

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
| `LENDER_ALIASES` | Optional owned aliases only |
| `HUBSPOT_SPONSOR_PROPERTY` / `HUBSPOT_SPONSOR_VALUE` | `contact_type` / `Sponsor`, or confirmed internal mapping |
| `OPENAI_API_KEY` | Your project API key |
| `OPENAI_MODEL` | A structured-output capable model available to your project |

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

The web and worker processes load the same `.env` file. Restart both after configuration changes. Never run a separate worker against PGlite's demo directory.

## 6. Stop at the authorization checkpoint

Before anyone connects accounts or starts live ingestion, confirm explicitly:

> The local configuration is ready. I authorize connecting this Gmail account and this HubSpot account, and running the agreed read-only live acceptance test.

Do not include credentials or account identifiers in that message. The next step is the controlled procedure in [live-acceptance.md](live-acceptance.md). Connecting is separate from making changes to HubSpot records or sending email; those actions are performed by the owner manually and are never implicit agent authorization.
