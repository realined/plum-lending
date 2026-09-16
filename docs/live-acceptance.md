# Mandatory live acceptance

**Status: NOT RUN. No live Gmail, HubSpot, or OpenAI account has been connected or processed. The submission is not complete until this checklist passes.**

The owner's explicit authorization is required before connecting or processing live data. Keep source-control evidence to counts, timestamps, boolean checks, and sanitized error categories. Never save real correspondence, identities, provider IDs, tokens, screenshots of live content, raw responses, or live CSVs in this repository.

## Prepare a small, independently checkable truth set

The owner identifies existing Gmail correspondents with messages between the interpreted start and cutoff. In the owner's free HubSpot account, the owner can manually create/confirm matching contacts and company associations. Use the actual sender email address; do not grant the agent implicit permission to create records or send emails.

Prepare at least these known cases, where available:

- Sponsor with a historical inbound message in the requested window, no directly associated Closed Won deal: include.
- Sponsor with an in-window inbound message and a directly associated Closed Won deal: exclude.
- Non-Sponsor with an in-window message: exclude.
- Sponsor whose only messages are outbound or outside the window: exclude.
- An included thread with lender replies and context outside the window: preserve all accessible messages.

The representative request excludes the most recent three months, so a newly sent test email cannot qualify. Use existing history for that gate. A separately reviewed request with zero recent months can exercise newly exchanged test data, but does not replace proof of the representative window. Do not alter dates or pass demo records off as live.

## Execute, with explicit owner permission

1. Start PostgreSQL, the web app in live mode, and the separate worker using `live-setup.md`.
2. Sign in with the local administrator password. The app must visibly say **Live data**.
3. Click **Connect** on Gmail. The owner completes Google sign-in and consent. Verify connected status; do not capture the mailbox identity in an artifact.
4. Paste the private-app token into the local masked HubSpot connection form. Verify connected status. This validates all required read endpoints and property mapping.
5. Confirm a recent worker heartbeat in Connections. Enter the representative query and select **Interpret request**. Confirm Sponsor mapping, inbound direction, frozen UTC timestamps, direct associations, and the Closed Won policy.
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
| Owner authorization | Pending |
| Date/time of test | Pending |
| Native PostgreSQL migration / worker | Pending |
| Live Gmail OAuth | Pending |
| Live HubSpot validation | Pending |
| Live OpenAI interpretation and semantic cases | Pending |
| Ingestion from both services | Pending |
| Independent eligibility comparison | Pending |
| Full-thread preservation | Pending |
| Correct live CSV download | Pending |
| Count-only result summary | Pending |
| Queue-inclusive runtime and dataset size | Pending |
| Owner approval of submission readiness | Pending |

If a live check fails, record the category (for example missing scope, field mapping, no historical data, expired OAuth grant), fix the cause, and repeat only the affected checks. Do not substitute mocked results or mark an incomplete export as a successful live acceptance.
