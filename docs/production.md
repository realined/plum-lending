# Extension and production plan

## Outlook adapter

Implement `EmailProvider` with Microsoft Graph authorization-code OAuth, delegated `Mail.Read`, encrypted refresh tokens, and explicit mailbox identity. Page messages through `@odata.nextLink`, fetch conversation members by `conversationId`, and account for folder boundaries; a conversation ID alone is not proof that every message has been collected. Map Graph addresses, headers, HTML/text, timestamps and attachments into the same Thread/Message schema. Persist delta links, handle reset tokens and deletions, and verify full-context semantics with recorded synthetic contract responses. Keep Graph fields out of the domain executor.

## Salesforce adapter

Implement `CRMProvider` using Salesforce OAuth and an org-scoped connection. Resolve Sponsor from confirmed Contact/Account custom fields or record types. Normalize Account and Opportunity objects and `OpportunityContactRole` relationships to canonical companies/deals/associations. Use metadata such as `IsWon`/`IsClosed`, rather than labels or hard-coded stage names. Page SOQL results using trusted server-authored query shapes; never accept LLM-authored SOQL. Handle org permissions, API quotas, pagination and missing contact roles explicitly.

## Incremental synchronization

The Gmail adapter already exposes history changes, deleted-message IDs, a next cursor, and a full-resync signal for expired history. The primary export pipeline deliberately fetches a fresh date-bounded mailbox snapshot and a fresh CRM snapshot each time. It does **not** yet apply history deltas to a continuously maintained mirror.

Production bootstrap should capture a high-water history cursor before the full scan, apply intervening deltas, and atomically advance the cursor only after successful canonical writes. On expired cursors, perform a reconciliation scan; do not advance past failed changes. Apply deletion tombstones and changed threads. For Gmail push, renew watch subscriptions and treat notifications as hints. For HubSpot use changed-object timestamps/webhooks plus periodic reconciliation, refreshing associations and deletions. Cursor ownership belongs to connection generation, tenant, provider, and sync version.

## Scaling jobs and exports

The queue uses PostgreSQL atomic claims, SKIP LOCKED, leases, heartbeats, bounded recovery, stable entity IDs, and conditional transactional publication. Add independent supervisors, readiness/health endpoints, metrics, dead-letter tooling, explicit cancellation, per-tenant concurrency limits and worker shutdown grace periods. Persist per-thread checkpoints if replay costs become material. The CI smoke test verifies native PostgreSQL and separate web/fixture-worker processes. Production still needs multi-worker contention, crash/load, recovery and operational acceptance with real provider behavior.

Current provider retrieval is sequential and memory-bound. Before handling a large mailbox, identify eligible contacts first, use bounded provider search batches, cache normalized threads by generation, and process/save records in chunks. Preserve an exclusion audit and separate inaccessible data from nonmatches. CSV responses are paged/streamed; for very large exports, stream into encrypted object storage and issue short-lived authorized downloads.

## Multitenancy

Introduce tenant/workspace and connection-generation keys in every table, job, cursor, log context, and blob path. Use compound foreign keys, PostgreSQL row-level security where appropriate, tenant authorization on every endpoint, tenant-specific encryption context, audit events, scoped deletion, and isolation tests. Provider IDs are only unique within their tenant/account/provider namespace. A UI workspace selector is not an isolation control.

## Deployment

Use a persistent Node service and separate workers with a managed PostgreSQL database. Do not deploy the embedded-worker POC to short-lived serverless functions. Use TLS, a managed secret store/KMS, private networking, SSO, backups and restore testing, migration rollout discipline, observability, and least-privilege service roles. Apply retention policies to correspondence and exports. Perform Google OAuth verification if distributing outside a private test setting, and review email data handling requirements. HubSpot OAuth replaces private-app tokens for customer self-service onboarding.

No deployment, production account changes, or expanded integrations have been performed. These are designs for future work, not claimed implemented capabilities.
