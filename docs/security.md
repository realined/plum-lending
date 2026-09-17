# Security and privacy

## Implemented boundaries

- Live mode requires a PostgreSQL URL, administrator password, independent session signing secret, and a 32-byte encryption key. Demo mode uses isolated PGlite and ignores live database configuration. Queue claims also enforce the current mode.
- Live admin routes require an expiring HMAC-signed, HttpOnly, SameSite=Lax session. Cookies are Secure for HTTPS. Mutating endpoints require the exact configured Origin. Sign-in attempts have a small process-local throttle. The shared password is not enterprise identity management.
- Google OAuth runs on the server with authorization-code exchange, PKCE, random state, a ten-minute encrypted HttpOnly state cookie, and explicit scope checking. Only `gmail.readonly` is requested. Tokens use AES-256-GCM with random nonces and versioned authenticated ciphertext. No access or refresh token is returned to the browser.
- HubSpot tokens enter a masked field and go directly to the local server over the application's authenticated connection. Validate required read endpoints before saving. Provider records are never written.
- Replacing a connected account is prohibited until explicit disconnect. Each connection has an immutable generation. Gmail token lookups are generation-bound; a concurrent refresh can adopt a peer's token only for the same generation. Disconnect deletes derived records and queued jobs, so stale workers cannot publish.
- Zod validates API requests, structured model outputs, provider pages, canonical messages, and segment policy. SQL values use parameters. SQL identifiers are fixed internal allowlists. The model has no provider or database tool access.
- HTML is sanitized and converted to text. The UI renders plain text/JSON through React escaping, never arbitrary email HTML. Remote images and tracking pixels are not rendered. Attachments are metadata only; Gmail-externalized readable MIME bodies are fetched separately.
- Every CSV field is quoted, quotes are doubled, and values that could become formulas are prefixed with an apostrophe, including whitespace/control-prefixed formula triggers. UTF-8 BOM supports common spreadsheet readers.
- Application logs contain event categories, opaque local job UUIDs, and counts. They do not contain query text, identities, message bodies, OAuth codes, provider error bodies, or credentials. Next incoming-request logging is disabled to avoid OAuth URL leakage. Avoid verbose provider HTTP debugging during live tests.
- The OpenAI request contains only the administrator's query and policy instructions, with `store:false`. Query text still leaves the machine in live mode; users should keep unnecessary PII out of it.

## Data lifecycle

Connection disconnect revokes the Google refresh grant when possible, deletes the local provider credential, and purges **all derived workspace data**, including requests and exports. This broad purge is explicit in the confirmation UI because this POC has one joined workspace. HubSpot private-app token revocation is an owner action in HubSpot. Remove an optional bootstrap token from `.env` as well. Delete-data preserves connections but clears normalized entities, jobs, interpretations, and results.

A database purge cannot revoke copies of already-downloaded CSVs or backups. A provider request already in flight may finish after deletion, but final publication is fenced by a row lock and job ownership. Full cancellation is future work.

`.env`, `.data`, `.next`, logs, traces, reports, and dependencies are gitignored. The package script uses an explicit reviewed source manifest rather than recursive directory zipping. Sample CSV and demo screenshot are synthetic only. Live outputs must be downloaded outside the repository and are never submitted.

## POC limits before production

Replace shared-password login with SSO/OIDC, tenant-scoped authorization and audited roles. Add distributed login/API rate limits, session revocation, CSRF tokens where cross-origin deployment requires them, key rotation/KMS, encrypted disks/backups, retention/deletion schedules, secret scanning, alerts, and access review. Tighten CSP with per-request nonces; the POC allows inline framework scripts and development eval. Require TLS everywhere outside loopback and validated database certificates.

The queue and adapters have bounded API retries but no global job time budget or per-tenant quotas. Large provider datasets can consume significant memory and API quota. No unreviewed public deployment is authorized.

## Review outcomes

An independent review identified and prompted fixes for demo/live database crossover, account replacement during ingestion, concurrent refresh races, incomplete HubSpot permission validation, and accepting non-PostgreSQL live configuration. Regression tests cover these. The review is a useful engineering check, not a claim of a completed penetration test or compliance certification.

## Mixed-use Gmail account: test-only validation

The approved interview mailbox has unrelated correspondence. Gmail OAuth remains mailbox-wide, while the default application scope is `seed-only`. Require an explicit expected account and private seeder insertion receipt. Restrict candidate search to the seed label with ID-only responses, require exact message membership, and fetch approved message IDs individually to avoid a mixed-thread race. A privacy-boundary error aborts the complete export and publishes no records; it is not a partial-success case. No real correspondence is part of the seed manifest or model input.

The configuration/manifest are trusted local inputs, not an OAuth security sandbox. `mailbox` is an explicit operator opt-out for separately authorized accounts and must never be used for the owner's mixed-use interview mailbox. Prior stored exports are not retrospectively scrubbed; no live data has yet entered this project. See `mailbox-isolation.md` for tests, limitations and remaining live verification.
