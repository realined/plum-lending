# Verified live baseline — Plum Lending

**Current expanded demo:** 20 source contacts and 59 Gmail messages; fresh live result 10 contacts / 12 rows / 45 messages in 22.869 seconds, with verified download. See [expanded acceptance](expanded-live-acceptance.md). The seven-contact results below are the original baseline history.

Technical acceptance passed on September 16, 2026 Eastern (September 17 UTC), ahead of the September 17, 4 PM Eastern presentation. This report is the requested checkpoint before refinement. No further product changes, deployment or publication are implied.

## Outcome

The complete browser workflow works with real OpenAI, Gmail and HubSpot: natural-language request → reviewed typed criteria → durable job → separate worker → live provider snapshots → deterministic filtering → full-thread normalization → preview and downloaded CSV. Gmail contains only explicitly approved fictional messages within the app’s receipt-restricted corpus; unrelated mailbox content is excluded. The normal application integrations remain read-only.

| Evidence | Actual result |
| --- | --- |
| Seed corpus | 7 contacts, 7 companies, 3 deals; 6 Gmail threads, 9 messages |
| CRM relationships | 7 contact/company links, 3 contact/deal links |
| Writer replay | Same journaled IDs, no duplicate creates |
| Live language evaluation | 5/5: representative, paraphrase, alternate date window, unsupported amount, unsupported outbound |
| Final browser export | Succeeded: 2 contacts, 2 threads, 5 messages, 5 exclusions, 0 failures |
| Queue-inclusive export time | 7.087 seconds; earlier typed-specification jobs: 6.862 and 7.402 seconds |
| Download | Actual browser download; 8 exact headers, 2 rows, 5 normalized messages; matches stored result bytes |
| Repeated ingestion | Canonical counts stable; same saved request returns existing job |
| Final local checks | ESLint, strict TypeScript, 253 tests across 9 files, production build all passed |

Connection setup involved owner-operated consent and private credential entry; no reliable end-to-end consent timing was recorded. The seven-second measurement begins when the export is queued and excludes interpretation and download. Five instrumented model cases took 0.901–4.397 seconds each. This is evidence on a small controlled corpus, not a production-scale benchmark.

## Expected versus actual

Names below are authored fictional fixtures, not copied service content.

| Case | Expected | Actual |
| --- | --- | --- |
| Cedar / Sponsor / qualifying inquiry / open deal | Include full four-message thread | Pass |
| Granite / Sponsor / qualifying inquiry / Closed Won | Exclude | Pass |
| Juniper / Sponsor / recent-only inquiry | Exclude | Pass |
| Old Mill / Sponsor / inquiry older than window | Exclude | Pass |
| Birch / Broker / qualifying inquiry | Exclude | Pass |
| Willow / Sponsor / qualifying inquiry / Closed Lost | Include one-message thread | Pass |
| Meadow / Sponsor / no matching email | Exclude | Pass |

The UI groups the three date/no-mail negatives as “No qualifying inbound email.” The other exclusion groups are “Not a Sponsor” and “Closed Won deal.” The model specifies the policy; domain code applies it. Current Closed Won on a directly associated contact deal excludes across all time. Company-only associations and historical stage transitions are not treated as equivalent.

## Normalization and CSV

The final browser request froze its own UTC dates. It uses a 24-calendar-month lookback and excludes the latest 3 months; it does not reuse the seed preview’s frozen clock. All seven expected cases remain unchanged.

The four-message Cedar thread includes the historical inbound messages, lender replies, a recent response beyond the matching cutoff, synthetic CC and attachment metadata. Schema and chronology checks pass. The UI thread drawer and normalized JSON work. Binary attachment content is not exported.

CSV headers are `Email Subject`, `Email Body`, `Account Name`, `First Name`, `Last Name`, `Email`, `Last Activity Date`, and `Raw Communication Data`. The compatibility body column contains complete thread text. Compact JSON preserves normalized communication data; quoting, UTF-8 BOM and formula-injection protection are covered by automated tests. Live downloads stay private outside the repository because their recipient fields include the approved mailbox identity.

## What failed and how it was resolved

- HubSpot rejected `.test` contact addresses. After owner approval, namespaced reserved `@example.com` contact addresses replaced them, while company domains/RFC IDs remained unchanged. Automatic company association was disabled. A private write journal enabled reconciliation of the single known created company without duplicating it.
- Comparing two live CSV files byte-for-byte found one changed opaque Gmail attachment retrieval ID. Every other field matched. Content/eligibility and entity deduplication are stable; raw provider handles are not guaranteed byte-stable.
- API setup required a separate funded API balance, despite an existing ChatGPT subscription. The owner created a restricted key privately, funded credit and confirmed automatic reload off. No secret was committed or printed.

## Live, mocked and unverified

**Live verified:** Gmail OAuth/profile and encrypted storage, HubSpot private-app validation/portal identity, seed creation/replay, reviewed CRM associations, protected Gmail ingestion, actual OpenAI structured output, deterministic output, separate PostgreSQL worker, UI review/results/thread/JSON/download and repeat ingestion.

**Mocked automated coverage:** malformed responses, scope/account mismatch, boundary privacy failures, expired state, partial failures, retries, lease recovery/fencing, CSV attacks and cleanup. Five real-model cases are a small semantic check, not a comprehensive evaluation benchmark.

**Not exercised on the live corpus:** cleanup, destructive disconnect/delete, refresh-token expiry, worker-crash recovery, provider outages and realistic-volume load. Historical Linux CI passed 7 UI + 4 API tests and native PostgreSQL with injected synthetic providers; that CI run predates later privacy/seeder work. The supported in-app browser exercised the final live workflow. No new CI publication occurred.

## Security, reliability and debt

Secrets remain in ignored mode-0600 environment files or encrypted storage; source scanning excludes configured secret/mailbox values. Runtime export logs were event/local-job-ID/count only. AI receives the request, never correspondence or CRM records. Seed-only receipt membership is stronger than a label filter, but Gmail’s OAuth read scope is still mailbox-wide: receipt integrity and token/server protection remain essential.

The implementation uses per-run snapshots, not continuous incremental sync. It stores canonical matched threads and an immutable result snapshot, not a complete mailbox mirror. Jobs use leases and idempotent writes; full-run retries can repeat reads. Single-workspace scope, serial association fetching, no per-thread durable checkpoints, limited history paging, and no production observability/quotas remain debt. A seven-day OpenAI key and Testing-mode OAuth require expiry planning before later demos. The $1 allowance is operator-managed, not a product-wide hard spending cap.

Two UI issues observed during validation are cosmetic/wording issues, not blocked controls: the initial loading shell briefly says “Demo environment” before live state arrives, and the queued message suggests starting the worker before its next poll even when a worker is healthy. No evidence of live records being loaded into demo mode was observed.

## Missing requirements and highest-value next steps

No identified blocker remains for the agreed technical Gmail/HubSpot POC vertical slice. Final owner acceptance, presentation rehearsal and a publication decision remain handoff work. Continuous sync, Outlook, Salesforce and multitenancy are documented extension work, not claimed implemented.

| Priority | Proposed improvement | Classification |
| --- | --- | --- |
| 1 | Rehearse the exact live sequence twice; prepare a concise evidence/architecture presentation and clearly labeled offline fallback | High-value presentation polish |
| 2 | Correct the initial mode label and queued-worker wording without redesigning the UI | High-value polish |
| 3 | Add safe interpretation token/cost/latency evidence and expand semantic evaluations around ambiguous requests | Production-hardening; optional polish subset |

**Required handoff:** owner reviews this baseline, practices the technical explanation, and decides whether/when to push the reviewed source. **Out of scope before the presentation:** more providers, general agents/vector search, multitenancy, continuous sync, public deployment or a redesign. Wait for owner approval before beginning refinement.

## Interview concepts to defend

1. AI translates intent; Zod validates it; deterministic TypeScript decides eligibility.
2. A matching message selects a complete conversation, including context outside the date window.
3. Durable queues and stable provider IDs provide at-least-once execution with idempotent persistence, not a blanket exactly-once guarantee.
4. Separate writer/read permissions and exact message receipts protect the controlled live demo from unrelated mail.
5. Real-account acceptance catches provider behavior that mocks cannot prove; state what was measured and what remains untested.

Important modules: `src/server/parser.ts`, `src/domain/segment.ts`, `src/domain/executor.ts`, `src/domain/normalize.ts`, `src/domain/csv.ts`, `src/providers/`, `src/server/repository.ts`, `src/server/worker.ts`, `src/seed/`, and the workspace/thread UI components. See `architecture.md`, `assumptions.md` and `security.md` for implementation decisions and constraints.
