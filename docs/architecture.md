# Architecture / ADR 001

Status: accepted for the interview POC.

Natural language → constrained intent → Zod validation → server-resolved SegmentSpec → administrator review → durable job → provider adapters → deterministic eligibility → canonical threads → contact/thread export.

## Decisions

- Next.js App Router with strict TypeScript. A small domain layer owns dates, identities, normalization, eligibility, and CSV. No agent framework or autonomous tools.
- OpenAI Responses structured output parses only the user's query. It receives no CRM contacts or email content. Unsupported scope and refusal produce an actionable error. Server policy resolves dates and meanings; model-generated dates or executable code are never accepted.
- PostgreSQL stores canonical entities, interpretation records, jobs, connections, cursor state, and export rows. Drizzle describes the relational model. Parameterized SQL implements queue operations where atomic lease semantics are clearest.
- No Docker is available in the development environment. Credential-free demo uses PGlite (embedded PostgreSQL), preserving SQL semantics and on-disk durability. It runs one Next.js process with a worker loop. Live mode requires PostgreSQL and an independent long-lived worker; there is no fire-and-forget request task or serverless guarantee. Demo ignores DATABASE_URL entirely, and queue claims enforce mode, preventing accidental live-data exposure in an unauthenticated demo.
- Job claims use atomic UPDATE with a locked candidate; a lease token fences stale workers. Heartbeats extend leases. Expired jobs are replayed with stable IDs and bounded attempts. Successful rows survive per-contact/thread failures. Export updates are conditional on owning the lease.
- CRM eligibility is evaluated first. Gmail searches bounded batches of validated eligible sender addresses and slightly broadened epoch dates, including Spam and Trash, then retrieves complete candidate threads and evaluates exact participant/timestamp conditions locally. HubSpot adapters fetch paginated objects and explicit paginated contact associations; custom pipeline metadata determines Won status.
- The first slice takes a fresh CRM snapshot and CRM-scoped, date-bounded Gmail search per job. Gmail incremental history is exposed through the provider interface and tested; full background incremental materialization and webhooks are a documented next step.

- URL search parameters own the selected view and saved run. Draft query text remains transient; saved results always display their original immutable query. Polling is abortable and serialized.
- A mode-scoped worker heartbeat is separate from each job's expiring lease. Readiness exposes recent/stale/unseen worker observations; setup checks expose configuration shape without contacting external services.

## Boundaries

`src/domain` is provider-independent. `src/providers` validates and translates API responses. `src/server` owns secrets, storage, HTTP protections, parsing, and workers. `src/components` receives safe view models. Credentials never reach client bundles.

## Tradeoffs

Read-only sequential provider access favors correctness and rate-limit control over throughput. The UI previews a bounded result page; exports retain normalized JSON in PostgreSQL. Large production exports should stream to encrypted object storage with short-lived download authorization. Shared-secret login is sufficient for a local interview POC; deployment needs an identity provider, tenant boundaries, audits, retention, and operational controls.

## Official API references

- [OpenAI structured output](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Gmail threads](https://developers.google.com/workspace/gmail/api/guides/threads)
- [Google server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server)
- [HubSpot deals](https://developers.hubspot.com/docs/api-reference/legacy/crm/objects/deals/guide)
- [HubSpot associations](https://developers.hubspot.com/docs/api-reference/crm-associations-v4/guide)
