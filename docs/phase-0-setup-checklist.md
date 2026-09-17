# Phase 0 — dedicated live environment inspection

**Historical checkpoint:** the owner subsequently approved an existing job-search/BenTech mailbox for synthetic-only use. Current setup adds an expected-mailbox check and a seed receipt; see [mailbox isolation](mailbox-isolation.md) and [updated live setup](live-setup.md). The original Phase 0 findings below describe the earlier implementation, not the current configuration contract.

Inspected 2026-09-16. Feature development is paused except the owner's separate logo request. No account-creation pages, credentials, live provider connections, seed writes, deployment, or publication were performed. Existing personal Gmail accounts are excluded from every subsequent phase.

## Verified baseline

Checkout: `/Users/leebennett/Projects/plum-lending`; private remote: `realined/plum-lending`; clean at audit start on `main`, HEAD `4ff6d5a`. This checkpoint adds documentation and the requested official logo locally.

Fresh `pnpm check`: lint, strict types, **174 tests**, and production build passed. Fresh `pnpm test:api`: **4 passed in 5.6 seconds**. Prior unchanged backend evidence: [Linux CI](https://github.com/realined/plum-lending/actions/runs/35142338893) passed 7 browser + 4 API tests and native PostgreSQL 17 with separate web/worker processes. That worker uses injected synthetic providers. It is not live-service proof. Local standalone Chromium remains blocked by the Mac sandbox.

No `.env` or `.env.local` exists. This was checked by existence only. Docker, psql and Docker Desktop were not found in the checked locations. A local PostgreSQL runtime remains a prerequisite.

## Exact account and credential checklist

| Item | Required configuration / action |
| --- | --- |
| Dedicated mailbox | Create a new Gmail account only; do not use either existing personal account |
| Google project | New dedicated POC project; enable Gmail API |
| Consent | External / Testing for consumer Gmail; dedicated address is an authorized test user |
| Client type | Web application |
| Redirect URI | `http://localhost:3000/api/connections/gmail/callback` |
| App OAuth scope | `https://www.googleapis.com/auth/gmail.readonly` only |
| HubSpot account | Free CRM registered using the dedicated Gmail; owner has permission to manage private apps |
| HubSpot authentication | Private-app bearer token; no HubSpot OAuth implementation |
| Sponsor mapping | Contact property internal name `contact_type`, value `Sponsor` |
| Provider credentials file | Owner edits `/Users/leebennett/Projects/plum-lending/.env` locally |
| Model dependency | Live query interpretation requires `OPENAI_API_KEY`; no API spending or new billing is authorized |

Suggested Gmail usernames, availability unverified: `lee.integration.lab@gmail.com`, `bentech.lending.demo@gmail.com`, `lee.workflow.poc@gmail.com`. Owner selects the address and completes all personal details, security prompts, legal acceptance, consent and secret entry. No address has been selected.

The existing HubSpot setup documents five read-only scopes: `crm.objects.contacts.read`, `crm.objects.companies.read`, `crm.objects.deals.read`, `crm.schemas.contacts.read`, `crm.schemas.deals.read`. These cover the three object families, Sponsor property and deal pipeline metadata. No write, marketing, sensitive-data, or invented generic association scope is needed by the app. In Phase 3, validate the actual endpoint permissions and reduce redundant schema grants if the object-read grants suffice; the minimum working grant has not yet been tested against an account. [Private apps](https://developers.hubspot.com/docs/apps/legacy-apps/private-apps/overview), [scope reference](https://developers.hubspot.com/docs/apps/legacy-apps/authentication/scopes).

Before connection validation, the owner can create the empty Contact property `contact_type` as single-line text. This creates schema, not seed records. Use the account's existing deal pipeline and discover its IDs rather than creating extra pipelines or assuming stage names. Dataset creation waits for Phase 4 approval.

### Existing environment names — not secret values

| Variable | Value or owner action |
| --- | --- |
| `APP_MODE` | `live` |
| `APP_URL` | `http://localhost:3000` |
| `GOOGLE_CLIENT_ID` | Owner enters Web client ID locally |
| `GOOGLE_CLIENT_SECRET` | Owner enters client secret locally |
| `GOOGLE_REDIRECT_URI` | `http://localhost:3000/api/connections/gmail/callback` |
| `LENDER_ALIASES` | Leave blank for the dedicated mailbox unless it has verified owned aliases |
| `HUBSPOT_PRIVATE_APP_TOKEN` | Owner enters the private-app token locally |
| `HUBSPOT_SPONSOR_PROPERTY` | `contact_type` |
| `HUBSPOT_SPONSOR_VALUE` | `Sponsor` |
| `DATABASE_URL` | Generated local Compose URL, or approved local PostgreSQL URL |
| `EMBEDDED_WORKER` | `false` |
| `ADMIN_PASSWORD`, `SESSION_SECRET`, `TOKEN_ENCRYPTION_KEY` | Generated privately by `pnpm setup:live`; do not display or replace after token storage |
| `OPENAI_API_KEY` | Owner enters locally only after resolving the no-charges constraint |
| `OPENAI_MODEL` | Existing default `gpt-4.1-mini` |

There is **no primary Gmail address environment variable**. The callback obtains the address from Gmail's profile and persists it with the encrypted connection. `LENDER_ALIASES` is not an account allowlist. Phase 4 must introduce a separate ignored local seed manifest containing the approved mailbox and HubSpot account identifier, with a fail-closed identity check. Neither this manifest nor its configuration names have been implemented yet.

## Startup commands (documented, not run against live accounts)

After the owner completes local runtime setup:

```sh
cd /Users/leebennett/Projects/plum-lending
export PATH="/Users/leebennett/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
pnpm setup:live
# Owner fills .env in a local editor; never print it.
# Start Docker Desktop before the following command.
docker compose up -d postgres
pnpm config:check
pnpm db:migrate
pnpm build
pnpm start
```

Second terminal in the same directory and with Node/pnpm on PATH:

```sh
pnpm worker
```

`setup:live` creates `.env` with mode 0600 and refuses overwrite. It prints no generated values. `config:check` checks field presence/shape, not service authentication. The Compose file is `docker-compose.yml`, PostgreSQL 17 on loopback. Restart both processes after environment changes. Stop the existing demo server before starting live mode on port 3000. Visit `http://localhost:3000`, not the 127.0.0.1 hostname, because origin/callback checks are exact.

## Implementation findings and data flow

| Modules | Verified behavior |
| --- | --- |
| `src/server/config.ts`, `.env.example`, `scripts/prepare-live.ts` | Existing environment contract and private bootstrap |
| `src/server/oauth.ts`, `api.ts`, `src/app/api/[...path]/route.ts` | Authenticated OAuth start/callback; state, PKCE, offline consent, profile discovery |
| `src/providers/gmail.ts`, `src/domain/normalize.ts` | Sender/date candidate queries; full-thread reads; MIME text/HTML normalization and attachment metadata |
| `src/providers/hubspot.ts`, `src/server/connections.ts` | Private-app reads, properties, pagination, company/deal associations, pipeline normalization |
| `src/domain/executor.ts`, `segment.ts`, `csv.ts` | Deterministic eligibility, frozen UTC window, complete context, exact 8-column export |
| `src/db/schema.ts`, `db/migrations/`, `src/server/worker.ts` | Canonical entities, durable jobs, separate worker, stable provider IDs and upserts |
| `scripts/sample.ts`, `src/providers/demo.ts` | Offline fixtures and sample export only; **no live seeder** |

Query → constrained model interpretation → reviewed frozen specification → durable job → HubSpot snapshot and eligibility → narrowed Gmail search/full threads → canonical data → deterministic results → CSV. Export jobs perform snapshot ingestion; there is no separate continuous-sync worker or Sync button. Repeated synchronization acceptance means separate reviewed runs and canonical deduplication, not replaying a cached result.

Sponsor matches the configured property value case-insensitively. A deal is Closed Won only when its `(pipeline ID, stage ID)` metadata has `isClosed=true` and numeric `probability=1`. Closed Lost (`isClosed=true`, probability 0) is allowed. Missing/ambiguous stage or association data fails closed. Direct contact/deal associations are used, across all time; company-level deals are not inferred.

The Gmail connection is tested through the actual UI. HubSpot has a masked connection form that validates immediately, but the owner selected local `.env` entry for this phase: **environment-token bootstrap currently validates only when a live export worker starts**. Phase 3 needs an explicit invocation of the existing read-only validation path before seeding; no credential-check CLI currently exists. Do not start an export merely to hide this setup gap.

The CSV's exact existing header is `Email Body`, which contains the complete thread; the user's “Email Body / Thread” describes that field. Other headers: `Email Subject`, `Account Name`, `First Name`, `Last Name`, `Email`, `Last Activity Date`, `Raw Communication Data`. No header change was made.

## Missing pieces and approval gates

1. Dedicated accounts, OAuth grant, HubSpot grant and local PostgreSQL are unconfigured. Account setup uses the built-in browser after this checklist; the owner handles every secret, security prompt, consent and legal acceptance.
2. Live seeder is absent: no `ALLOW_DEMO_SEED` guard, dedicated-account verification, stable namespace/manifest, idempotent writes, dry-run or cleanup yet. Phase 4 must implement these separately from normal app startup and read-only credentials, then show the records, expected results, permissions, dry-run and cleanup for approval before writes.
3. Proposed expected set: qualifying Sponsor/no won **include**; qualifying Sponsor/won **exclude**; recent-only **exclude**; older than two years **exclude**; non-Sponsor **exclude**; qualifying Sponsor/Closed Lost **include**; Sponsor/no matching email **exclude**. Full names, fictional companies, stable IDs and timestamps belong in the later reviewable manifest.
4. Gmail insertion can preserve historical dates through message insertion and `internalDateSource=dateHeader`, without sending mail. Four-message grouping must be verified using returned thread ID plus matching subject and RFC reply headers; stable Message-ID alone is not an idempotency guarantee. [Insert API](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/insert).
5. Cleanup needs an explicit decision: the app currently searches Spam/Trash too, so moving seed messages to Trash alone would not reset eligibility. Do not request broad permanent-delete access or change search semantics silently. Present a namespace-scoped cleanup strategy for approval in Phase 4. [Gmail scope definitions](https://developers.google.com/workspace/gmail/api/auth/scopes).
6. The live parser uses a metered OpenAI API. Confirm an approved arrangement compatible with the owner's no-charges instruction before any call. No billing setup, paid calls or silent mock fallback is authorized. [API pricing](https://developers.openai.com/api/docs/pricing).
7. Live acceptance must verify associations and complete matching threads, exclusions against the seed manifest, repeat-run deduplication, timings, logs and CSV. Prefiltered nonmatching email threads may never be ingested; do not equate a correct exclusion with a complete mailbox mirror.

No live-service success is claimed. After the first real run, deliver the baseline report and three ranked improvements, then wait before refinement.

## Interview talking points

- Real API integration with controlled synthetic records differs from mocked HTTP/provider contracts.
- Read-only runtime credentials and separately authorized seed writers have different purposes and permission boundaries.
- Typed interpretation proposes criteria; deterministic code selects contacts and preserves full-thread evidence.
- Configuration readiness, authentication, ingestion and correct output are separate acceptance gates.
- Stable provider IDs plus reconciliation make replay safe; namespace-scoped cleanup must match retrieval semantics.
