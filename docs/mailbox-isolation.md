# Test-data-only access to the approved Gmail account

## Decision and acceptance boundary

The owner has authorized reusing an existing job-search/BenTech Gmail account instead of creating a new mailbox. It contains unrelated correspondence, which must not enter the application, database, model prompts, logs, screenshots or exports. Only messages inserted by the approved fictional-data seeder may be read as content. No account has been connected yet; this implementation has only synthetic automated proof.

This changes the account-selection plan, not the requirement to exercise real Gmail OAuth, live APIs, deterministic rules, complete synthetic threads and a live-connected CSV. A separate free HubSpot instance remains required. Approval to use this mailbox is not approval to access its unrelated messages. The earlier dataset-preview/dry-run approval checkpoint still applies to seed writes.

## Implementation and request flow

- `src/server/gmail-access.ts` validates the expected mailbox and loads a private insertion receipt. Live ingestion defaults to `seed-only`. A missing, empty, malformed or wrong-account receipt blocks processing before provider access.
- `src/server/oauth.ts` uses the expected mailbox as a login hint and checks the actual profile returned by Google before saving credentials. A login hint alone is not enforcement.
- `src/providers/gmail-seed-policy.ts` validates the versioned namespace, label ID, unique thread/message IDs and stable RFC Message-IDs. Only the seeder's actual insertion responses should supply these IDs; never populate the receipt with real mail.
- `src/providers/gmail.ts` retains CRM sender and date candidate narrowing, adds the exact custom label ID, and requests thread IDs only, excluding list snippets. Unknown results stop the run.
- For each allowed thread, `threads.get(format=minimal)` with an explicit field mask checks its exact message membership without headers, subjects, snippets or bodies. Mixed or incomplete threads stop the run before content retrieval.
- Bodies are retrieved with individual `messages.get` calls for the exact allowlisted IDs, never `threads.get(full)` in protected mode. This prevents an unrelated reply arriving between checks from being fetched. Returned IDs, RFC IDs, namespace header and subject prefix are verified; membership is checked again before normalization. Full approved thread context, including out-of-window messages, is retained. Text-part hydration is restricted to those same message IDs; binary attachment bodies remain unfetched.
- `DataBoundaryError` is fatal in `executeSegment`, and the existing worker failure path publishes no canonical records or export rows for the failed run. Public errors contain fixed text only. The preview and CSV continue to read persisted results; they do not fetch additional mail.
- Protected incremental synchronization returns a scoped-rescan requirement without calling mailbox-wide history.

The private receipt is a trusted local input. This is application-enforced data minimization, not a Google-issued label-only permission. Gmail's `gmail.readonly` scope still permits mailbox-wide reading. It does not sandbox a compromised server/token. Keep tokens, the receipt and the local database private, and keep the operator configuration fixed. Existing stored exports are not retrospectively scrubbed; this project has never ingested live data and must start its live acceptance with a fresh database. No mixed thread is silently truncated to make a run appear complete.

Primary API references: [minimal thread retrieval](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.threads/get), [individual message retrieval](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/get), [thread listing](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.threads/list), [OAuth scopes](https://developers.google.com/workspace/gmail/api/auth/scopes).

## Local configuration

New supported fields have been added to `.env.example` and the runtime; these are not secrets. The owner will set them in `/Users/leebennett/Projects/plum-lending/.env` together with the previously documented credentials:

```dotenv
GMAIL_EXPECTED_MAILBOX=<the owner-approved job-search/BenTech Gmail address>
GMAIL_DATA_SCOPE=seed-only
GMAIL_SEED_MANIFEST_PATH=.data/live-seed/manifest.json
```

Do not switch this account to `mailbox`. That explicit operator setting preserves the original unrestricted adapter for separately authorized accounts; it is not permitted for this mixed-use interview mailbox. The setup UI describes the selected scope without exposing configuration values. `config:check` checks configuration shape; the receipt is required at ingestion time, after the seeder exists. OAuth profile verification does not require a seed receipt because it reads no correspondence.

The selected address is recorded privately in ignored `.data/live-seed/account-selection.json`, not in source documentation. This records intent only; it is not a seed receipt or active `.env` configuration. No `.env` credentials have been created or inspected during this checkpoint.

## Seeder contract — pending implementation and owner approval

The future guarded seeder must insert only wholly fictional content into the approved account, retain the returned Gmail message/thread IDs, attach a stable custom label, and publish a complete version-1 receipt atomically. Required message markers:

- `Message-ID: <namespace.stable-message-key@example.test>`
- `X-Plum-Poc-Namespace: namespace`
- `Subject: [namespace] Fictional subject` (matching across the entire thread)

Receipt structure: `version`, `mailbox`, `namespace`, `labelId`, and `threads`, each containing `id` and `messages[{id,rfcMessageId}]`. IDs must be real insertion results, never guessed. The parser allows at most 100 threads and 100 messages per thread for this controlled acceptance dataset, and the loader caps the receipt at 1 MB.

Use valid References/In-Reply-To and the returned thread ID to group messages; verify actual membership after insertion. Dry-run, `ALLOW_DEMO_SEED`, account checks, stable namespace, idempotent reconciliation, separate write authorization and cleanup are still outstanding. Trash alone is not a reset because the app includes Trash. Removing the seed label as part of a scoped reversible cleanup may now support isolation; the exact cleanup plan must be reviewed before execution. No permanent deletion or broad delete permission is approved.

## Validation and limitations

Fresh checks: lint, strict types, **204 tests across 7 files**, production build, and **4 API tests in 5.6 seconds** passed. Thirty tests were added across the seed boundary, OAuth and worker persistence suites. Cases cover invalid receipts, default/invalid scope, missing/wrong account, accidental labels, missing/duplicate/extra/mismatched membership, mid-read private replies, direct unknown IDs, marker mismatch, full synthetic context through CSV, disabled broad history, immutable allowlist snapshots, safe errors, and zero publication after a later thread fails.

All HTTP responses in these tests are synthetic. Live consent, provider field-mask behavior, real message grouping, local PostgreSQL and actual CSV acceptance remain unverified. The most recent full browser/native PostgreSQL CI run predates this change; no new CI run or source push was triggered because publication is paused.

## Interview talking points

1. OAuth permission scope versus application retrieval scope.
2. Search labels narrow candidates; immutable insertion IDs establish membership.
3. A check-then-fetch race is avoided by fetching approved message IDs individually.
4. A fatal privacy boundary differs from a recoverable per-thread outage.
5. Whole-thread completeness can be preserved for approved threads while mixed threads fail closed.
