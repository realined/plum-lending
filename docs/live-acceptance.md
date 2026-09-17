# Mandatory live acceptance

**Current expanded demo:** 20 source contacts and 59 Gmail messages; fresh live result 10 contacts / 12 rows / 45 messages in 22.869 seconds, with verified download. See [expanded acceptance](expanded-live-acceptance.md). The seven-contact results below are the original baseline history.

**Status: TECHNICAL LIVE ACCEPTANCE PASSED on 2026-09-16 Eastern (2026-09-17 UTC). Real Gmail OAuth, HubSpot private-app access, controlled live seeding/replay, five real-model interpretation cases, reviewed browser execution, both provider ingestions, deterministic filtering, full-thread normalization and authenticated CSV download are verified. Final owner review, rehearsal and publication approval remain separate handoff steps.**

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
| Owner authorization | Approved synthetic-only account, reader/writer consent, sample archival, reviewed seed writes and reserved-domain compatibility adjustment |
| Date/time of test | 2026-09-16 Eastern: seed/replay, two typed-specification runs and the complete natural-language browser journey |
| Native PostgreSQL migration / worker | Owner Docker PostgreSQL 17.11 healthy on loopback; migrations 1/2 applied; separate live worker heartbeat and authenticated web UI verified |
| Live Gmail OAuth | Passed: actual consent/callback, approved profile equality, encrypted token, Connected UI and receipt-restricted ingestion |
| Live HubSpot validation | Passed: real read checks, approved portal identity, encrypted connection, snapshot ingestion and reviewed associations |
| Live OpenAI interpretation and semantic cases | Passed: 3 supported requests and 2 unsupported requests behave correctly; owner authorized up to $1 usage and confirmed funded account/auto-reload off |
| Ingestion from both services | Passed with normal read-only adapters and separate live worker |
| Only approved synthetic message IDs requested and persisted | Offline negative-boundary tests pass; live receipt-restricted positive run passed |
| Independent eligibility comparison | Passed: 2 expected contacts; exclusions: 1 non-Sponsor, 1 Closed Won, 3 without qualifying inbound email |
| Full-thread preservation | Passed: 4-message thread retains recent reply, CC and attachment metadata; UI inspected |
| Correct live CSV download | Passed: browser download plus private file parsing; 8 exact headers, 2 rows, 5 normalized messages and populated subject/body |
| Count-only result summary | 7 CRM contacts scanned; 2 contacts, 2 threads, 5 messages, 5 exclusions, 0 failures |
| Queue-inclusive runtime and dataset size | Typed-specification jobs: 6.862 s and 7.402 s; natural-language UI job: 7.087 s; provider corpus: 7 contacts, 7 companies, 3 deals, 6 threads, 9 messages |
| Owner approval of submission readiness | Technical baseline delivered; owner review/rehearsal and publication decision pending |

If a live check fails, record the category (for example missing scope, field mapping, no historical data, expired OAuth grant), fix the cause, and repeat only the affected checks. Do not substitute mocked results or mark an incomplete export as a successful live acceptance.

## Repeatability and evidence limits

Live seed replay reused every journaled object/message ID with no duplicate creates. Two independent reader jobs succeeded; canonical counts remain 7 contacts, 7 companies, 3 deals, 2 matched threads and 5 messages. Re-enqueuing the same reviewed request returns the same job. All exported fields match except one opaque Gmail `providerAttachmentId`, which changed between reads; semantic content is stable, but raw CSV bytes are not identical. Keep that distinction explicit.

The reader runs used `Reviewed seed specification (integration test; no AI)` as their interpretation source. They prove live ingestion, deterministic filtering, normalization, persistence and CSV; they do not prove real-model interpretation. The first CSV was also downloaded through the authenticated UI into the owner’s private Downloads folder and parsed without displaying content. No live CSV, mailbox identity or provider identifier is committed. Live cleanup and controlled worker-restart recovery have not been exercised.

## Complete natural-language browser run

The representative challenge sentence was entered through the live application. The UI displayed OpenAI structured output before execution: exact Sponsor mapping, inbound direction, 24-month lookback excluding 3 recent months, direct currently Closed Won exclusion across all time, and complete-thread retention. UTC dates were freshly frozen by the actual interpretation; they differ from the seed preview’s frozen reference time without changing the expected cases.

Run succeeded in 7.087 seconds including queue time: 7 scanned contacts, 2 included contacts, 2 threads, 5 messages, 5 exclusions, 0 failures. The private comparison confirms the exact two expected contact identities, all normalization schemas, chronological positions, recent context, CC and attachment metadata. Canonical counts remain 7 contacts/7 companies/3 deals/2 matched threads/5 messages, with 7 contact-company and 3 contact-deal links. Re-enqueueing the same saved request returns its existing job.

The browser’s thread drawer and normalized JSON were inspected without publishing provider identifiers. Actual CSV download parsed successfully: 8 exact columns, 2 rows, 5 messages and populated subject/body fields. Downloaded bytes equal the stored result serialized by the CSV generator for that run. Across separate reads, one opaque Gmail attachment retrieval ID may vary, as documented above.

All five live semantic cases passed in five requests, with 1,362 input tokens and 228 output tokens, an estimated $0.0009096 at the checked model rates. The browser interpretation was one additional invocation; its token usage was not captured by the app, so an exact total cost is not claimed. The bounded request/output sizes and single allowed retry keep this small acceptance run within the approved $1 ceiling. Owner reports API credit added and auto-reload off. This is an operator budget, not a product-wide hard spending cap.

Runtime logs observed for the three exports contained only event, local job ID and aggregate counts; no correspondence, provider identifiers or credentials. Automated tests still mock provider failures and adversarial cases. Live cleanup, destructive disconnect/delete and worker-crash recovery were deliberately not exercised against the presentation corpus.
