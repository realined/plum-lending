# Controlled live seed — review proposal

Status: the deterministic dataset, MIME generator, separate OAuth helper, guarded provider writer, durable operation journal, preflight, replay and cleanup commands are implemented and contract-tested offline. Separate writer credentials and live preflight/apply/cleanup remain **unverified**. Nothing in this document authorizes live writes. The normal app now has real Gmail and HubSpot connections, but still contains zero ingested records.

Run `pnpm seed:preview` to reproduce the proposal. It loads no environment file and has no network/database imports. Other arguments are rejected. The default frozen reference time is `2026-09-16T12:00:00.000Z`, so the qualifying interval is `[2024-09-16T12:00:00.000Z, 2026-06-16T12:00:00.000Z)`. The output includes a SHA-256 digest of the complete proposal. A changed namespace, date or record set requires a new review; the actual live request's frozen window must be checked before comparing results.

## Records and expected results

Every email uses `example.test`; the approved real mailbox will replace only the lender role inside the private insertion process. Every CRM contact email, company name/domain, deal name and RFC Message-ID will carry `bentech-lending-poc-v1`. These fictional names and amounts were invented for the challenge.

| Contact | Company (namespace prefix omitted here) | Role | Deal | Email scenario | Expected |
| --- | --- | --- | --- | --- | --- |
| Mira Vale | Cedar Gate Partners | Sponsor | Open | Four-message thread: historical inquiry, reply, follow-up, recent final reply | Include |
| Owen Reed | Granite Harbor Capital | Sponsor | Closed Won | Historical inquiry | Exclude: won deal |
| Lena Park | Juniper Row Partners | Sponsor | None | Recent-only inquiry | Exclude: date |
| Nolan Brook | Old Mill Ventures | Sponsor | None | Inquiry older than two years | Exclude: date |
| Iris Stone | Silver Birch Advisors | Broker | None | Historical inquiry | Exclude: contact type |
| Theo Marsh | Willow Court Holdings | Sponsor | Closed Lost | Historical inquiry | Include |
| Aria Quinn | North Meadow Partners | Sponsor | None | No message | Exclude: no email |

Proposed writes: **7 contacts, 7 companies, 3 deals, 7 contact/company associations, 3 contact/deal associations, 6 Gmail threads and 9 messages**. Expected result: **2 contacts, 2 CSV rows, 2 threads, 5 complete-thread messages**. CRM metadata determines stage IDs; the writer must not assume display labels are API IDs.

Cedar's thread contains a fictional $4.2 million loan inquiry for a 32-unit property, a request for operating information, a follow-up with a text attachment and synthetic CC, and a recent lender response. All four messages have plain-text and HTML alternatives. The recent reply is outside the qualifying interval and must remain in `Email Body` and `Raw Communication Data`. The other five message threads each contain one inbound email.

## Writer permissions — owner selected the narrow option

The owner selected option B: insert/read/labels, with synthetic messages retained in Gmail after cleanup. This decision approves the design, not a live seed execution. Keep both existing application credentials read-only. The writer needs a separate Google OAuth client/grant and a separate HubSpot private app, with credentials held only in ignored private configuration.

- **Gmail option A (move seeded mail to Trash):** `https://www.googleapis.com/auth/gmail.modify`. This permits insertion, verification, label changes and moving messages to Trash. It is a broad mailbox permission and also technically permits sending; the writer must explicitly allow only approved insertion/label/trash endpoints and must have no send path. Never request `https://mail.google.com/` or permanently delete messages.
- **Gmail option B (recommended: narrower capability):** `gmail.insert`, `gmail.readonly` and `gmail.labels`. Insert fictional messages and verify them; cleanup deletes only the dedicated seed label and disables the receipt, leaving the synthetic messages in the mailbox. This avoids a send-capable grant but cannot perform the proposed Trash cleanup.
- **HubSpot writer:** the five current read scopes plus `crm.objects.contacts.write`, `crm.objects.companies.write`, and `crm.objects.deals.write`. Reuse `contact_type` and existing pipelines. Do not request schema-write or marketing permissions. Verify actual endpoint scope requirements during preflight.

Gmail's insertion method accepts a raw message and `internalDateSource=dateHeader`; it does not send the inserted mail. Thread grouping requires the returned `threadId`, matching subjects and valid reply headers. See [message insertion](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/insert) and [thread requirements](https://developers.google.com/workspace/gmail/api/guides/threads). The proposed distinction between scopes follows [Google's scope definitions](https://developers.google.com/workspace/gmail/api/auth/scopes).

## Implemented writer safeguards — live proof still required

1. Refuse live operations unless `ALLOW_DEMO_SEED=true`, the owner-approved proposal digest matches, and the configured namespace is stable. Preview remains entirely offline.
2. Verify the Gmail profile and HubSpot portal against the ignored owner-local selection before reads/writes. HubSpot's private-app token information endpoint can verify the portal and scopes without placing a token in a URL. See [private-app token information](https://developers.hubspot.com/docs/apps/legacy-apps/private-apps/overview).
3. A private exclusive run lock and durable operation journal record intended creates before calls and returned IDs afterward. An uncertain create leaves a pending operation and blocks replay until inspected; there is no automatic reconciliation for an ambiguous outcome yet. Successful recorded operations are reused. A repeated RFC Message-ID alone does not guarantee deduplication.
4. Reuse known successful provider IDs, verify namespace markers and associations, and reject untracked collisions. Never adopt arbitrary mailbox messages or include unrelated content in the insertion receipt.
5. Generate the app's private `manifest.json` only after complete verification, using actual successful Gmail insertion response IDs. Verify minimal thread membership before publication; any unknown message blocks publication.
6. Explicit preflight, apply and cleanup commands run independently of the app. Repeating apply reuses recorded IDs and idempotent association PUTs. Tests cover disabled/mismatched-account rejection, no send/trash/permanent-delete endpoint, uncertain-write handling, duplicate prevention and namespace-scoped cleanup.

## Proposed cleanup and reset

Stop web/worker processes before apply or cleanup; the CLI additionally rejects queued/running exports. Disable the insertion receipt before cleanup. The active-job check is not a shared lock against a newly queued export, so stopping the app is an operational prerequisite. Verify each recorded ID and namespace again. Archive only the recorded HubSpot contacts, companies and deals. Under option A, remove the custom seed label and move only recorded seed message IDs to Trash. Under option B, remove only the dedicated seed label; explain that synthetic mail remains searchable in Gmail itself. The app searches Spam/Trash, so Trash alone is insufficient. Never delete an entire thread that might include an unseeded reply, empty Trash, or delete unrelated records.

Keep the private operation journal for recovery and replay evidence. A reset policy must account for archived CRM records and the retained/trash Gmail messages; do not blindly recreate a dataset after cleanup. Offline tests verify replay and label-only cleanup. Actual provider behavior still needs live verification. Apply after cleanup is deliberately blocked; restoring archived CRM objects or creating a newly reviewed namespace is a manual recovery decision.

## Evidence and remaining gate

Thirty-five focused tests pass. The original fifteen cover deterministic fixture identity, safe date/namespace input, changed-plan rejection, header-injection rejection, all MIME dates/headers/bodies/CC/attachment round-trips, and the real normalization/filter/CSV path producing exactly the two expected contacts while preserving all four Cedar messages. Gmail projection is simulated in that test; actual Gmail threading, internal dates, associations, repeat seeding and live CSV output remain unverified.

The owner selected the narrow cleanup policy. Additional writer tests verify account/scope mismatch rejection, replay without duplicate creates, an uncertain-create journal, mixed-thread rejection, label-only cleanup, endpoint restrictions, exact writer scopes, encrypted short-lived authorization, and a real local HTTP callback rejecting a mismatched state before any Google request. Separate credentials and owner consent are needed next. Run read-only preflight, then seek approval of the concrete live operation before any insertion or CRM record creation. The OpenAI no-charges constraint remains a separate gate before the final natural-language run.


## Exact separate credential setup

1. Run `pnpm seed:setup` once. It creates `.env.seed` with mode 0600 and refuses to overwrite it. This file is already covered by `.gitignore`; never commit it. Keep normal `.env` reader credentials unchanged.
2. Use a separate Google Cloud seed project to isolate its consent configuration. Enable Gmail API, use External/Testing, and add the same approved mailbox as the sole test user. Register only `gmail.insert`, `gmail.readonly`, and `gmail.labels`. Handle Google policy/terms/security prompts manually.
3. Create a **Web application** OAuth client named `BenTech Lending Lab Seed Writer`. The implemented helper callback is exactly **`http://127.0.0.1:3001/seed/callback`**. No JavaScript origin is required. Save its client ID and secret privately in `.env.seed` as `SEED_GOOGLE_CLIENT_ID` and `SEED_GOOGLE_CLIENT_SECRET`. The helper refuses to reuse the reader client. Use a separate project as instructed; project identity is not automatically verified by the helper.
4. In the existing free HubSpot lab account, create a second private app named `BenTech Lending Lab Seed Writer`. Use the eight scopes above (five reads, three object writes), no schema-write grants. Privately save its token in `.env.seed` as `SEED_HUBSPOT_PRIVATE_APP_TOKEN`. The CLI rejects reusing the reader token.
5. Set `ALLOW_DEMO_SEED=true` in `.env.seed` only for the explicit seed workflow. Run `pnpm seed:auth`; the helper prints only the local start URL `http://127.0.0.1:3001/seed/start`. The owner opens it and completes consent. It uses state/cookie checks and PKCE, requires the exact three scopes and approved Gmail profile, encrypts a short-lived access token in `.data/live-seed/writer-token.json`, and redirects to a clean completion URL. It does not store a refresh token or change the normal application grant. Close the consent tab before tool observation resumes. Reauthorize if it expires.
6. Run `pnpm seed:preflight`. This verifies identities, writer permissions, text Sponsor schema, one unambiguous deal pipeline, CRM records and the seed label/message journal. A new lab must be empty; untracked CRM records, duplicate labels, missing recorded IDs, changed records or pending writes cause a safe stop. Only counts and fixed diagnostic categories are printed.
7. Present the dry-run, successful preflight and exact expected results to the owner. **Wait for explicit seed execution approval.** Then stop web/worker processes and run `pnpm seed:apply --approve=<reviewed-plan-sha256>`. The digest comes from `pnpm seed:preview`; it is a consistency check, not a substitute for human approval. Successful apply atomically publishes the private Gmail insertion receipt after metadata, associations and thread membership checks. Start web/worker again afterward.
8. For an approved cleanup, stop live processing and run `pnpm seed:cleanup --approve=<reviewed-plan-sha256>`. This invalidates the receipt first, archives only verified journaled CRM records and deletes only the verified dedicated label. It refuses untracked labeled messages. It retains all Gmail messages and does not automatically clear existing app exports; separately review local-data cleanup through the app before a new acceptance baseline.

The scope selection is owner-approved; credential creation, Google consent, live preflight and record-write approval are not completed yet. No tokens, accounts, operation journal or insertion receipt should enter source archives. A stale lock or pending create must be inspected before any manual recovery; do not remove it simply to force a retry.
