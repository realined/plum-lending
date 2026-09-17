# Implementation plan

## 1. Foundation and deterministic domain
- [x] Inspect workspace, brief, and reference headers only
- [x] Establish repository guidance, assumptions, architecture
- [x] Typed SegmentSpec and constrained natural-language interpretation
- [x] Synthetic fixture with positive, negative, boundary, and failure cases
- [x] Domain tests, normalization, CSV safety

## 2. Integration and persistence
- [x] PostgreSQL/Drizzle schema and initial migration
- [x] Durable job lease, retry/recovery, stable upserts
- [x] Gmail adapter implementation and mocked contract verification
- [x] Gmail live OAuth/read-only grant, approved-account profile and encrypted connection verified
- [ ] Gmail live ingestion acceptance
- [x] HubSpot adapter implementation and mocked contract verification
- [x] HubSpot live read checks and encrypted application connection verified
- [ ] HubSpot live account identity, associations and ingestion acceptance
- [x] Auth, encrypted credentials, disconnect and local-data deletion
- [x] Mocked provider and database integration tests

## 3. Admin workflow
- [x] Connections, interpretation, run, progress, counts
- [x] Results, full-thread inspection, download
- [x] Empty, unsupported-query, loading, error, partial success states
- [x] Critical flows and responsive visual review in supported in-app browser
- [x] Standalone Playwright browser suite: 7 UI tests passed in Linux CI (plus 4 API tests); Mac sandbox launch limitation remains local
- [x] Complete shell interaction audit fixes: workspace chevron, breadcrumb, upper avatar, lower profile; no misleading inactive controls
- [x] Add URL-backed navigation and distinguish edited drafts from prior run results
- [x] Make demo parsing limitations, live setup readiness, and demo history scenarios explicit

## 4. Handoff
- [x] Setup, architecture, security, production expansion notes
- [x] Synthetic sample CSV, demo script, interview walkthrough
- [x] Lint, strict types, unit/integration tests, production build
- [x] Final offline security/regression review and source-only archive
- [x] Initial Git commit on `main`; clean checkout, ignore rules, and repository integrity verified
- [x] Create private `realined/plum-lending`, push existing history with owner authorization, and verify matching local/remote SHA with `main` tracking `origin/main`
- [x] Move the complete checkout to the owner's `~/Projects/plum-lending`; revalidate dependencies, checks, and demo startup

## Acceptance and risks
Demo must produce repeatable, explainable rows without credentials; full context outside the qualifying window must survive. Live adapters are exercised with contract mocks AND must pass a real-account acceptance run with the user’s Gmail and free HubSpot account before the submission is complete. Gmail history can expire, HubSpot Sponsor properties vary, and association failures must fail closed. Embedded demo PostgreSQL is single-process; live mode requires PostgreSQL and an always-on worker.

## Mandatory live acceptance (user clarification)
- [x] Close automated OAuth start/callback and live-parser response-boundary coverage gaps
- [x] Review/narrow mailbox candidate retrieval and retain safe, actionable failure categories before dedicated-account ingestion
- [x] Verify native PostgreSQL migrations and separate web/worker processing in CI with explicitly injected synthetic providers
- [x] Verify the owner's local PostgreSQL and production worker with real account connections
- [x] User completes Google OAuth and grants read-only Gmail access
- [x] User connects a free HubSpot account with a private-app token
- [ ] Ingest real data from both services
- [ ] Verify deterministic eligibility and complete thread preservation against selected real records
- [ ] Generate and download a CSV from live-connected data
- [ ] Measure actual dataset size and elapsed runtime against the challenge target
- [ ] Record sanitized evidence without correspondence, identities, or credentials

## Latest verified evidence
- Latest local: 253 Vitest tests across nine files pass, including 35 seed-plan/writer/OAuth tests. The preceding mailbox-isolation checkpoint passed 4 production API tests; those were not rerun for the separate CLI seeder. Earlier Linux CI passed 7 browser + 4 API tests before the mailbox-isolation change; no new CI publication has been performed.
- ESLint and strict TypeScript pass; production Next.js build passes.
- Production dependency audit: no known vulnerabilities reported.
- In-app browser: review/run, exact counts, full thread, download action, history after restart, partial/empty/outage/unsupported states verified.
- A first-run on-disk PGlite directory bug found in application verification was fixed; clean-directory startup and persistence checked.
- Linux Chromium: 11/11 tests passed in 21.2 seconds. Native PostgreSQL process/CSV check passed. [CI evidence](https://github.com/realined/plum-lending/actions/runs/35142338893) at application commit `5c6de87`.
- Google OAuth consent/callback/profile and encrypted persistence are verified against the approved account. The real HubSpot adapter authentication check passed with the owner-saved token; no record content or secret values were displayed, stored or logged.

## Requirements audit — 2026-09-16
- [x] Reconcile original brief, owner clarification, source code and visible UI; see `requirements-audit.md`
- [x] Verify all three sidebar destinations and the complete-thread drawer in the supported browser
- [x] Rerun isolated production API workflow tests: 3 passed in 6.1 seconds
- [x] Resolve the shell interaction and offline integration-boundary gaps; real-account acceptance remains open

The shell and core synthetic export journey are verified. Current phase: owner selected an existing job-search/BenTech mailbox; test-only isolation verified offline; dedicated Google Cloud project and Gmail API enablement verified; private environment created; Testing registration, sole test user and read-only scope saved; owner reports Google client creation and credential entry, with private field-presence/isolation checks passed. HubSpot onboarding and `contact_type` creation are verified. The owner created the read-only private app and privately saved its token; the real adapter authentication check passed. The live app now uses fresh Docker PostgreSQL 17.11 with migrations 1 and 2 and a separate worker. HubSpot is encrypted in the database and visibly Connected after administrator sign-in. The owner completed actual Gmail consent; the callback saved the approved profile and encrypted token, and the live UI shows two Connected providers. Both live ingestions remain pending. Configuration readiness, mocked contracts, native infrastructure checks and live-service proof remain separate evidence levels. Continuous incremental sync remains deferred; the history adapter is not connected to the worker.

## Dedicated live baseline — owner-requested sequence

- [x] Phase 0: inspect repository/config/routes/adapters/schema/seeding/tests; run non-destructive checks; provide exact setup checklist (`phase-0-setup-checklist.md`)
- [x] Revised Phase 1: owner confirms existing job-search/BenTech account for synthetic-only use; new-account creation is superseded; live Gmail profile now verified
- [x] Implement and verify test-only ingestion: expected account, seeder receipt, restricted ID queries, mixed-thread rejection and no publication on boundary failure
- [x] Phase 2 preparation: dedicated Cloud project created and Gmail API enabled; private `.env` created with `0600`, ignored and untracked (no provider credentials yet)
- [x] Phase 2 configuration: owner API-policy agreement completed; External/Testing app, sole approved test user and `gmail.readonly` scope saved
- [x] Phase 2 credential handoff: owner reports client creation and private entry; both Google fields, exact callback, expected mailbox, seed-only settings and `0600`/Git-ignore protection verified without value output
- [x] Phase 2 completion: owner completed actual app OAuth consent; callback, approved account profile, encrypted persistence and live Connected UI verified
- [x] Phase 3 preparation: free CRM signup/wizard completed; automatic mail/contact sync skipped; empty Deals board observed; separate safe HubSpot read-check CLI implemented and tested offline
- [x] Phase 3 schema: single-line text contact property `contact_type` created and internal name verified; five read scopes selected in the unsubmitted private-app form
- [x] Phase 3 authentication: owner created private app and saved token; actual adapter read checks passed for contacts, Sponsor property, companies, deals and pipelines before seed records
- [x] Local runtime: owner installed/started Docker Desktop; PostgreSQL 17.11 healthy on loopback; migrations 1 and 2 applied; live web and separate worker verified with fresh heartbeat and authenticated UI
- [x] HubSpot application connection: existing connection function revalidated and encrypted the environment token; live UI shows Connected; no CRM records stored
- [x] Phase 4 proposal: deterministic seven-case dataset, MIME generator and offline dry-run; owner selected insert/read/labels with retained Gmail messages on cleanup
- [x] Phase 4 implementation: separate OAuth helper, guarded writer, private operation journal, preflight, replay and label-only cleanup; 35 focused tests pass
- [ ] Phase 4 live proof: separate writer credentials/consent, real preflight, explicit dataset approval, seed both services, verify replay without duplicate creates
- [ ] Phase 5: actual app connections, snapshot ingestion/associations, reviewed request, expected/actual comparison, full-thread CSV, repeat-run verification, timings and regression checks
- [ ] Phase 6: baseline report and ranked improvements; wait for owner approval before refinement

Only the owner-selected job-search/BenTech account is approved, under seed-only restrictions. Unrelated correspondence and other personal mailboxes remain excluded. All secrets, MFA, recovery, consent and legal acceptance are handled manually by the owner. No charge, deployment or publication is authorized. `pnpm seed:preview` and `pnpm sample` are offline only. The live writer, durable replay journal and cleanup commands are implemented and tested with synthetic provider responses. Separate writer credentials, live preflight and live writes are still pending; no seed write has occurred.


## Presentation deadline — Thursday, 2026-09-17, 4:00 PM America/New_York

The owner specified the deadline; the earlier feature pause remains in effect. Targets below are planning targets, not completed gates or a guarantee against external account delays.

- [ ] By 1:00 PM: achieve the verified deliverable — approved seed in both real services; actual natural-language interpretation; full ingestion; seven expected inclusion/exclusion cases; two CSV rows and five full-thread messages; eight required CSV columns; repeat-run deduplication; observed runtime; sanitized evidence
- [ ] Resolve the OpenAI API credential and no-spending gate with the owner before any live model request; a rules/mock parser is not live AI proof
- [ ] By 2:00 PM: final regression/diff/privacy review, current source package and documentation, local checkpoint; obtain fresh publication authorization before pushing
- [ ] By 3:00 PM: two rehearsals of the live workflow, architecture explanation and tradeoff Q&A; prepare a clearly labeled offline fallback and private synthetic-only evidence if approved
- [ ] After the verified baseline and owner review only: selective presentation polish, prioritizing explainability and reliability over new features

Defer additional providers, continuous synchronization, multitenancy, deployment and an interface redesign. Presentation success depends on independently demonstrated correctness and a defensible architecture, not the number of features.
