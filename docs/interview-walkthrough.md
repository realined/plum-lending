# Technical interview walkthrough

Status note: discuss automated proof and live proof separately. Until `live-acceptance.md` is filled with verified results, say the adapters are implemented and contract-tested, **not** that real-account acceptance is complete.

## 60-second product explanation

“Plum needs to find relevant lending relationships across a CRM and a mailbox without losing the history behind them. This application lets an administrator describe an audience, review exactly how the request was interpreted, and generate a CSV with one contact/conversation pair per row.

“The AI translates language into a constrained schema. It never chooses contacts or runs queries. The server validates that schema, freezes the date window, and applies deterministic rules to CRM deals and normalized email messages. A matching message brings in its entire thread, including context outside the qualifying dates.

“The job is durable, the UI explains exclusions and incomplete results, and the export carries both readable conversation text and machine-readable JSON. Gmail and HubSpot are the implemented adapters. The demo is fully synthetic; real-account acceptance is a separate required gate.”

## Five-minute architecture walkthrough

**Minute 1 — Product contract.** Show the example and interpretation card. Explain Sponsor as a configured property value, inbound direction, UTC calendar subtraction, direct contact associations, and currently Closed Won. Start with semantics; a beautiful pipeline implementing the wrong audience is still wrong.

**Minute 2 — Trust boundaries.** The browser sends only query text. OpenAI Responses structured output returns a small typed intent. Zod validates it; server code resolves dates and policy. The browser later submits the stored interpretation ID. Provider payloads are independently validated. No model-generated SQL, autonomous API tools, or email bodies in prompts.

**Minute 3 — Data retrieval.** HubSpot supplies contacts, company/deal objects, associations and pipeline metadata. Gmail search finds candidate thread IDs; full-thread reads preserve context. Adapters translate provider formats into canonical entities. Exact identities and deterministic rules produce rows and evidence.

**Minute 4 — Durability and safety.** PostgreSQL stores requests, jobs and results. Workers claim jobs with locks, lease them, heartbeat, and publish only if they still own the lease. Stable IDs and upserts make replay idempotent. Token encryption, OAuth state/PKCE, authenticated routes and origin validation protect access. Partial data is labeled, not hidden.

**Minute 5 — Evidence and tradeoffs.** Inspect a thread, exclusions and CSV. Explain tests at domain, provider contract, database, security and browser layers. Distinguish synthetic proof from real-account proof. Identify current scale limits and explain exactly how additional providers, incremental sync and tenancy would fit.

## Twenty-minute deep dive

| Time | Topic | Code / evidence to inspect |
| --- | --- | --- |
| 0–2 min | User need and explicit semantics | Interpretation card; `docs/assumptions.md` |
| 2–5 min | Intent schema and server policy | `src/domain/segment.ts`, `src/server/parser.ts` |
| 5–8 min | Gmail and HubSpot adapters | `src/providers/gmail.ts`, `hubspot.ts`, `contracts.ts` |
| 8–11 min | Matching, MIME and thread evidence | `executor.ts`, `normalize.ts`, tests |
| 11–14 min | Relational model and durable work | `src/db/schema.ts`, `repository.ts`, `worker.ts` |
| 14–16 min | Authentication, OAuth, secrets | `auth.ts`, `oauth.ts`, `connections.ts`, security tests |
| 16–18 min | Results, CSV and partial failures | UI, `csv.ts`, `api.ts`, sample CSV |
| 18–20 min | Measured validation and next steps | Build journal, live checklist, production notes |

## End-to-end request flow

1. The administrator writes a query. Demo uses an explicitly limited local parser; live mode sends only the query and policy instructions to OpenAI.
2. The interpreter returns a constrained intent. Unsupported requests and refusals do not execute. Zod validates allowed fields and ranges; the server computes a frozen calendar window in UTC.
3. The request/spec/assumptions/source are stored and shown for review. The administrator starts an export using the interpretation ID.
4. The API creates a queued job, deduplicated by interpretation. It returns promptly. A worker claims the row with an expiring owner lease.
5. The worker fetches a fresh CRM snapshot. It verifies associations and stage mappings, failing closed when absence of a won deal cannot be established.
6. Eligible CRM identities become bounded Gmail sender/date searches. No eligible contacts means no Gmail request. Gmail yields deduplicated, paginated candidate thread IDs. Every candidate thread is read in full, validated and normalized; per-thread failures become explicit gaps.
7. The deterministic executor matches exact sender identities to contacts, verifies lender recipients and timestamps, and excludes non-Sponsors or won/unknown deal relationships. It records qualifying message IDs and all thread messages.
8. A transaction checks ownership, upserts canonical records, writes unique contact/thread export rows, and marks the job terminal. A stale worker cannot publish after another worker, disconnect, or data deletion invalidates its ownership.
9. URL parameters select the view and saved run; a new draft clears the selected run. The browser polls persisted state and previews 25 rows at a time. The drawer displays plain text and JSON. CSV download reads stored rows in pages, preserving multiline text and applying formula defenses.

## Data model

Connections store provider, state, mailbox, encrypted credential, generation, last successful sync and cursor slots. Contacts have explicit identities and junctions to companies and deals. Deals carry normalized open/won/lost/unknown status. Threads contain provider IDs; messages store sender, To/CC/BCC, time, body, direction, attachments and position. Participant rows support structured querying while message JSON preserves complete canonical context.

Segment requests retain the original query and frozen spec. Export jobs own status, stage, progress, attempts, lease owner/deadline, counts, failures and exclusions. Export results have a compound key `(job, contact, thread)`. Sync jobs track attempts and completion. Foreign-key cascades make workspace deletion invalidate dependent work.

The canonical tables preserve the latest ingested state, while export-row JSON preserves a run's result snapshot. This POC materializes matched email threads rather than a complete historical mailbox mirror. Provider IDs are scoped to demo/live in the single-workspace design; production needs tenant/account/generation keys.

## Gmail OAuth and ingestion

Authorization-code OAuth requests `gmail.readonly`, offline access and consent. State plus PKCE binds the redirect to the originating attempt; an encrypted short-lived cookie carries the verifier. The server exchanges the code and validates scope/profile. Refresh credentials are encrypted with AES-GCM. A connection generation prevents a worker from silently moving to another account during a run. Concurrent refresh accepts a fresh peer result only for the same generation.

Search combines eligible contacts' explicit primary/secondary addresses in batches of at most 20 terms (also bounded by query length). Gmail API alias expansion is not assumed. Search uses a slightly broad epoch-second window so Gmail search precision cannot accidentally exclude a boundary message. Local timestamp comparisons make the final decision. `threads.get?format=full` provides MIME trees; text body parts externalized as attachments are fetched when needed, while actual attachment files are not downloaded. Full thread means all messages the API exposes, not deleted or inaccessible content.

History synchronization exists as a tested adapter method: added threads, deleted message IDs, next cursor, and full-resync on cursor expiry. The export pipeline does not yet continuously apply these deltas. Do not claim otherwise.

## HubSpot ingestion and associations

The private-app token has read permissions only. Connection validation checks objects, Sponsor property and pipelines. Object and v4 association pagination are explicit, including repeated-cursor protection. The contact's primary email stays first, additional identities are normalized, and configured Sponsor matching cannot accidentally accept another raw role value.

Pipeline IDs and stage metadata determine won/lost/open. Unknown metadata stays unknown. Direct contact/deal associations determine exclusion; company-only deals do not exclude every employee. A missing association page or referenced deal cannot prove no closed deal, so the contact is excluded with a failure. A failure listing the full deal universe fails the run rather than returning misleading matches.

## Identity matching and time

Email addresses are trimmed and lowercased. Plus tags and dots are preserved, because provider-specific collapsing could join different people. Duplicate provider IDs are deduplicated. Contacts can have several known identities and can each appear in a shared conversation. No names, company domains or language-model guesses are used to invent identity links.

Dates are instants; ordering and comparisons use parsed timestamps rather than lexicographic strings. Calendar-month subtraction clamps month ends. The window is start-inclusive and end-exclusive. It freezes at interpretation, so queue delays do not move the audience. Last Activity Date reflects the full thread, even when later than the eligibility cutoff.

## Natural language, guardrails and explainability

Structured output constrains syntax and allowed concepts; it does not guarantee semantic correctness. The administrator reviews assumptions. The model is told to reject unsupported filters rather than silently drop them; the runtime rejects extra fields and invalid windows. A future evaluation set should measure whether paraphrases preserve every requested condition, especially negatives and ambiguous deal scope.

The executor is deterministic given the spec and provider snapshots. It supplies qualifying message IDs, exclusion totals and explicit failure categories. This is reproducible evidence, not a model-generated rationale after a decision.

## Background processing

A request-local promise could die when a process exits. A persisted queue survives that failure. An atomic `UPDATE` with a locked candidate and `SKIP LOCKED` chooses one job per worker. Heartbeats renew a 90-second lease. After expiry another worker may replay it, up to three attempts. Owner fencing prevents late writes; stable provider keys and transactional export replacement prevent duplicate rows.

This is **at-least-once execution with idempotent effects**, not a blanket exactly-once claim. API reads may repeat. Checkpoints are per run, so a crash can replay costly reads. A production worker should add per-thread checkpoints, cancellation, quotas, alerts and native multi-process stress tests.

## Normalization and CSV

MIME parsing handles nested text/plain and text/html parts, header/address decoding, charsets, and attachment metadata. Prefer a supplied plain body; otherwise derive text from sanitized HTML. Never render untrusted email HTML or load remote tracking pixels. Preserve available recipients, direction, timestamps and chronological positions. Invalid messages cause a visible thread failure rather than silent omission.

Rows use exact reference headers and readable subject/conversation fields. Raw Communication Data is compact thread JSON. Quoting handles commas, newlines and quotes; prefix formula-looking cells before quoting. CSV quoting alone does not prevent spreadsheet formula execution. Stream export pages to limit response memory; ingestion still has its documented snapshot memory limit.

## Testing and evidence

Domain tests isolate business meaning and boundary cases. Provider tests mock realistic paginated JSON and malformed/missing responses. Database tests execute real SQL in PGlite and inspect persisted state, rollback, lease recovery and fencing. Security tests use ephemeral generated keys and synthetic tokens. Browser tests assert the complete admin journey and error states; a sandbox-blocked browser launch is reported as blocked, not passed.

Live acceptance additionally proves real consent/scopes, account-specific property/stage mapping, actual data retrieval and a CSV checked against an independent truth set. Record only sanitized counts and boolean checks in the repo. Never submit real correspondence as a fixture or screenshot.

## Likely questions and strong answers

**Why use an LLM at all?** It translates varied user phrasing into a small vocabulary. It contributes language understanding while explicit schemas, policy and deterministic code own execution. The demo parser demonstrates that the business pipeline does not depend on AI availability.

**Why not let the LLM generate SQL?** It enlarges the permission and correctness surface unnecessarily. A typed domain spec supports known operators, visible assumptions, tests, and provider portability. Server-authored parameterized queries are easier to audit.

**Does schema validation make the query correct?** No. It makes it structurally valid. Human review and semantic evaluations are still needed to catch lost or misinterpreted conditions. I deliberately reject unsupported scope.

**Why retrieve messages outside the window?** The matching window decides eligibility. The export's purpose is reconstructable context, so truncating replies would lose the narrative that makes the result useful.

**How do you know a contact has no Closed Won deal?** Only after complete relevant association and deal reads with known stage mapping. Unknown is not false; I fail closed and report uncertainty.

**What happens if a worker crashes?** Its lease expires, the job replays, and stable IDs/upserts avoid duplicate effects. The new owner fences the old worker. Recovery is bounded and the job becomes terminal after exhaustion.

**What happens if the user reconnects another mailbox?** Direct replacement is rejected. Explicit disconnect purges joined data and invalidates jobs. A captured generation prevents token reads from crossing account boundaries.

**Why PGlite?** It removes Docker/account requirements for a local demo while retaining PostgreSQL semantics. It is intentionally isolated and single-process. Live mode requires ordinary PostgreSQL and a dedicated worker; PGlite is not being presented as the production topology.

**Why no vector database or embeddings?** Exact roles, timestamps, identities and deal states answer this task. Semantic retrieval would add cost and ambiguity without improving eligibility. A future content-search feature would need a separate privacy and evaluation design.

**What would you change first for production?** Tenant isolation/SSO, managed secrets and retention, native worker operational controls, bounded streaming ingestion, and incremental reconciliation. Then larger semantic interpretation evaluations and a second provider adapter to validate the abstraction.

**What is not finished?** Answer from the current build journal and live checklist. Never replace a missing real-account test with “the mocks passed.”

## Interaction and readiness questions

**Why put the selected run in the URL?** Refresh and Back should restore the same immutable request/results. Form text and interpreted criteria are transient draft state; mixing them with a previous export makes the screen misleading. Poll requests are aborted when the selected run/page changes, so an old response cannot overwrite the new selection.

**Does a green heartbeat prove Gmail works?** No. Worker readiness means that the worker recently reached the database. A job lease controls ownership and publication. Stored connection status means credentials passed validation when connected. A completed real-data acceptance run is stronger, separate evidence.

**Why narrow Gmail retrieval using CRM first?** Sponsor/deal eligibility can exclude irrelevant identities before mailbox reads. Search batches are an optimization; the deterministic executor still checks exact sender, lender recipients, UTC instants and deal rules against complete threads. A candidate can still contain unrelated participants; entire matching threads are preserved because context is part of the challenge.

**What does the new test coverage prove?** OAuth tests cover session gates, PKCE/state, callback expiry/tampering, scope/refresh requirements and encrypted persistence with mocked HTTP. OpenAI SDK mocks cover complete/refused/incomplete/invalid/unsupported/transport outcomes and the query-only input boundary. They do not prove Google's consent flow, the actual HubSpot account schema, or real-model semantic accuracy. The Linux CI workflow adds real Chromium and isolated PostgreSQL with a separate worker process using injected synthetic providers. Consult the build journal for actual run results.

**How are errors useful without leaking data?** Known provider status codes and the current stage map to owned recovery copy. Provider response text and arbitrary exception messages are never interpolated. Per-thread failures produce partial results; a failed candidate search prevents a misleading complete export.
