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
- [ ] Gmail live OAuth/read-only account acceptance
- [x] HubSpot adapter implementation and mocked contract verification
- [ ] HubSpot live connection/ingestion acceptance
- [x] Auth, encrypted credentials, disconnect and local-data deletion
- [x] Mocked provider and database integration tests

## 3. Admin workflow
- [x] Connections, interpretation, run, progress, counts
- [x] Results, full-thread inspection, download
- [x] Empty, unsupported-query, loading, error, partial success states
- [x] Critical flows and responsive visual review in supported in-app browser
- [ ] Standalone Playwright browser suite (7 tests): launch blocked by macOS sandbox; run outside sandbox
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
- [x] Review/narrow mailbox candidate retrieval and retain safe, actionable failure categories before personal-account ingestion
- [ ] Verify native PostgreSQL migration and separate web/worker processing
- [ ] User completes Google OAuth and grants read-only Gmail access
- [ ] User connects a free HubSpot account with a private-app token
- [ ] Ingest real data from both services
- [ ] Verify deterministic eligibility and complete thread preservation against selected real records
- [ ] Generate and download a CSV from live-connected data
- [ ] Measure actual dataset size and elapsed runtime against the challenge target
- [ ] Record sanitized evidence without correspondence, identities, or credentials

## Latest verified evidence
- 174 Vitest tests pass; four production API tests passed before the integration-hardening changes. CI revalidation pending.
- ESLint and strict TypeScript pass; production Next.js build passes.
- Production dependency audit: no known vulnerabilities reported.
- In-app browser: review/run, exact counts, full thread, download action, history after restart, partial/empty/outage/unsupported states verified.
- A first-run on-disk PGlite directory bug found in application verification was fixed; clean-directory startup and persistence checked.
- Seven standalone Playwright UI tests cannot launch Chromium under the current macOS sandbox. No pass is claimed.
- No live accounts, credentials, or data have been accessed.

## Requirements audit — 2026-09-16
- [x] Reconcile original brief, owner clarification, source code and visible UI; see `requirements-audit.md`
- [x] Verify all three sidebar destinations and the complete-thread drawer in the supported browser
- [x] Rerun isolated production API workflow tests: 3 passed in 6.1 seconds
- [ ] Resolve the newly identified interaction and integration-proof gaps above

The completed admin-flow items cover the core synthetic export journey. They do not imply that every element styled as a menu is interactive or that live integration has passed. Current phase: interaction completion and offline integration proof, followed by mandatory owner-approved real-account acceptance. Continuous incremental sync remains deferred; the history adapter is not connected to the worker.
