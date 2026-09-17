# Mandatory live acceptance

**Status: LIVE CONNECTIONS VERIFIED; FULL ACCEPTANCE NOT RUN. Actual Gmail OAuth, HubSpot read validation, encrypted connections, local PostgreSQL and a separate worker are verified. Live dataset ingestion, associations, interpretation and CSV output remain pending. OpenAI is not configured. The submission is not complete until the remaining gates pass.**

The owner's explicit authorization is required before connecting or processing live data. Keep source-control evidence to counts, timestamps, boolean checks, and sanitized error categories. Never save real correspondence, identities, provider IDs, tokens, screenshots of live content, raw responses, or live CSVs in this repository.

## Prepare the approved fictional truth set in real services

Use the selected job-search/BenTech Gmail account only in `seed-only` mode and a new free HubSpot instance. Do not use existing correspondents or unrelated real messages. The seeder must first pass its enable/account/namespace/idempotency guards, produce a dry-run and cleanup preview, and receive owner approval. Its actual insertion receipt is required before any live export can run. See [mailbox isolation](mailbox-isolation.md).

Include seven cases: qualifying Sponsor/no won (include); qualifying Sponsor/won (exclude); recent-only activity (exclude); older than two years (exclude); non-Sponsor (exclude); qualifying Sponsor/Closed Lost (include); Sponsor/no email (exclude). Preserve an approved four-message thread, including historical dates, valid reply headers, plain/HTML content, CC and attachment metadata.

Controlled historical dates must be explicitly inserted into the real Gmail service by the approved seeder; they are fictional test data, never claimed to be organic historical correspondence. The app must then read those actual live records. Mocks remain separate. Do not substitute a zero-month window for the representative 24-month-minus-3-month request.

## Execute, with explicit owner permission

1. Start PostgreSQL, the web app in live mode, and the separate worker using `live-setup.md`.
2. Sign in with the local administrator password. The app must visibly say **Live data**.
3. Click **Connect** on Gmail. The owner completes Google sign-in and consent. Verify connected status; do not capture the mailbox identity in an artifact.
4. Verify HubSpot using the supported local environment-token path. Read-only authentication/property checks must already have passed before seed records were created; environment presence alone is not proof. The masked UI form is an alternative only if the owner chooses it.
5. Confirm Gmail data scope is test-only, the private insertion receipt matches the approved mailbox, and a recent worker heartbeat in Connections. Enter the representative query and select **Interpret request**. Confirm Sponsor mapping, inbound direction, frozen UTC timestamps, direct associations, and the Closed Won policy.
6. On the owner's approval of these reviewed criteria, click **Run segment**. Observe completion and counts. A partial job is not sufficient to claim complete acceptance.
7. Compare included/excluded cases to the truth set directly in the accounts/UI. Inspect at least one full thread and its normalized JSON locally. Check sender, recipients, timestamps, ordering, bodies, subject, and attachment metadata.
8. Download the live CSV to an owner-controlled private location **outside the repository**. Verify all eight headers, one contact/thread per row, populated subject/body, and parsable JSON. Do not open a live CSV with formula execution enabled; output values already include formula protection.
9. Run a second reviewed request and confirm no duplicate canonical entities. Restart the worker and verify queue persistence with a controlled queued run if practical.
10. Record only the sanitized acceptance fields below. The owner confirms the live export is correct. Do not publish it.

## Small live interpretation evaluation

Run these only after OpenAI use is authorized. Record pass/fail and the normalized fields, never real contact data. The model's schema adherence alone is not semantic proof.

| Request | Expected behavior |
| --- | --- |
| Representative example in the application | Sponsor, inbound, 24-month lookback, exclude 3 recent months, no direct currently Closed Won deal |
| Find Sponsor contacts who emailed the lender between 24 months ago and 3 months ago and have no Closed Won deals in HubSpot. | Same policy/durations as the example; each interpretation freezes its own current `asOf` |
| Find Sponsor contacts who sent emails to the lender in the last 12 months, excluding the latest 2 months, and have no Closed Won deals in HubSpot. | 12-month lookback, 2-month exclusion; other constraints unchanged |
| Find Sponsor contacts with deals worth over $10 million. | Reject or request clarification; never silently drop the amount filter |
| Find only outbound messages to Sponsor contacts with no Closed Won deals. | Reject unsupported outbound-only policy |

For accepted requests, review the UI's fields before executing. If a model silently drops a condition, stop acceptance and fix the interpretation boundary/prompt/evaluation before proceeding.

## Runtime evidence

Record total CRM contacts scanned, matched contacts/threads/messages, CSV row count, failures, and elapsed seconds from the export request to terminal status. Label these counts precisely: matched threads are not all fetched candidates. Use the recorded job `created_at` and terminal `updated_at` for queue-inclusive export latency, and note any user-observed download delay separately. The challenge prefers minutes and allows hours; record actual results for the chosen real dataset rather than extrapolating from synthetic runtime.

## Sanitized acceptance record

| Gate | Result |
| --- | --- |
| Owner authorization | Approved account selected for synthetic-only use; owner completed read-only OAuth consent. Reviewed seed-write approval remains pending |
| Date/time of test | 2026-09-16: connection/infrastructure checks only; full live dataset run pending |
| Native PostgreSQL migration / worker | Owner Docker PostgreSQL 17.11 healthy on loopback; migrations 1/2 applied; separate live worker heartbeat and authenticated web UI verified |
| Live Gmail OAuth | Passed: actual owner consent/callback, approved profile equality, encrypted token and Connected UI; no message ingestion |
| Live HubSpot validation | Passed: five real read checks, encrypted application connection and Connected UI. API portal identity and associations pending |
| Live OpenAI interpretation and semantic cases | Blocked by missing API key and unresolved no-charges constraint; no paid call made |
| Ingestion from both services | Pending |
| Only approved synthetic message IDs requested and persisted | Offline tests pass; live proof pending |
| Independent eligibility comparison | Pending |
| Full-thread preservation | Pending |
| Correct live CSV download | Pending |
| Count-only result summary | Pending |
| Queue-inclusive runtime and dataset size | Pending |
| Owner approval of submission readiness | Pending |

If a live check fails, record the category (for example missing scope, field mapping, no historical data, expired OAuth grant), fix the cause, and repeat only the affected checks. Do not substitute mocked results or mark an incomplete export as a successful live acceptance.
