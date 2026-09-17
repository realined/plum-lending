# Technical review questions and defensible answers

## Why use an LLM at all?

The operator expresses intent in ordinary language. The model translates that intent into a small schema. That is a useful language task; identity matching, dates and eligibility remain deterministic code. The model never receives the contact corpus or email bodies.

## Does structured output guarantee the model understood correctly?

No. It guarantees shape, not meaning. Server validation restricts policy, the operator reviews assumptions, and tests evaluate representative, paraphrased, alternate-window and unsupported requests. Five original real-model semantic cases passed, with additional successful browser interpretations. Wider semantic evaluation remains production work.

## What exactly does “has not closed a deal” mean?

No directly associated deal currently marked Closed Won, across all time and pipelines. Closed Lost is allowed. This POC does not reconstruct historical stage transitions or treat a company-only association as a direct contact deal. Those are visible business assumptions that should be confirmed with the customer.

## Why twelve rows for ten contacts?

The export grain is a contact/thread pair. Alder and Harbor each have two different conversations. Stable provider IDs prevent duplicate ingestion; legitimate conversation multiplicity remains visible.

## How do you avoid losing context outside the date window?

Message-level identity/direction/time checks establish whether a thread qualifies. Normalization and export retain every accessible approved message in that thread, including older and recent context. A recent last-activity date is therefore compatible with a historical qualifying inbound message.

## How are contacts matched to messages?

Normalized email identities are compared with structured participants. Role and deal decisions use explicit CRM properties and associations, not display-name similarity or model inference. Named recipient groups are flattened before direction matching, covered by regression tests. Alias rules require explicit semantics; this is not fuzzy entity resolution.

## What is the queue reliability story?

Requests/jobs are persisted in PostgreSQL; a separate worker claims work using leases and ownership fencing. Heartbeats and bounded recovery protect publication. Stable IDs support replay. This is a tested small-POC queue, not a claim that all production crash/load scenarios have been exercised live.

## What happens when one provider request fails?

The application distinguishes failures and can expose partial results for recoverable retrieval failures. Privacy-boundary violations abort the export. A known refinement is more precise contact-level wording when eligibility cannot be verified because a thread failed; do not claim a failed read proves no communication exists.

## Why not use a managed ETL or workflow product?

The challenge required an executable proof of the core semantics, so small adapters made the boundaries testable. In Plum's environment I would evaluate existing ingestion and orchestration tools first. The reusable asset is the policy/normalization contract, not a desire to build a new general-purpose ETL system.

## Are the emails real?

They are real Gmail-stored messages with intentionally fictional content and historical dates, inserted by a separate writer. They were not sent to outside recipients and were not organically received over two years. The normal application actually reads Gmail and HubSpot APIs; offline mocks are separate.

## Is the mailbox restriction an OAuth sandbox?

No. Gmail readonly is mailbox-wide. The configured expected account, seed-label candidate search, exact insertion receipt and approved message membership checks enforce an application boundary. Credentials and the local receipt remain trusted inputs. Production tenant isolation and governance need more work.

## Does `store:false` settle training and retention requirements?

No. It is an API behavior setting, not a substitute for provider contracts, abuse-monitoring terms, retention requirements or client-specific hosting agreements. The stronger implemented minimization is that contact records and correspondence never enter the model request.

## What did AI-assisted development contribute?

It accelerated implementation, test expansion and focused reviews. I kept the architecture explicit and validated the result with code-level invariants and real accounts. Real-provider behavior exposed assumptions that mocks could not prove, such as HubSpot email-domain acceptance. Independent review also improved grouped-recipient and exact-thread-membership checks.

## What is demonstrated versus production-ready?

Demonstrated: real connections, interpretation, CRM associations, live ingestion, deterministic filtering, complete normalization, durable background execution and verified CSV. Next: SSO/roles/tenancy, operational quotas, retention/key management, observability, bounded concurrency and realistic volume/recovery testing. No compliance certification, penetration-test completion or production throughput guarantee is claimed.

## What would you improve first?

Start with clearer partial-error and unsupported-request feedback, then measure provider latency and quota use. Prioritize tenant/access/lifecycle controls before deployment. Add batch association reads and bounded concurrency when measurements justify them. Keep the stable policy tests as the regression contract.
