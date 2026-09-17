# Plum Lending — live demonstration script

A narrated walkthrough of the verified live application. Captured screens are real application views; architecture diagrams are explanatory. This is an edited walkthrough, not an uncut recording. Stock synthetic narration is for practice and presentation support, not an impersonation of the candidate.

Grounding: the interviewer emphasized practical integrations, applied AI, shipping speed and security. AI coaching blocks in the supplied transcript were excluded as evidence. No transcript or personal interview details belong in the narration.

## 01. The business problem

**On screen:** Turn fragmented relationship history into an actionable audience

This demonstration shows a working proof of concept for Plum Lending: turning CRM relationships and complete email conversations into an explainable audience and a clean export.

The business problem is fragmented context. A lender wants to reconnect with Sponsors who previously contacted the team but have not closed a deal. HubSpot knows the contact classification and deal relationships. Gmail contains the actual communication history. Looking at either system alone gives an incomplete answer. Manually joining the two is slow, repetitive, and difficult to verify.

The application automates that preparation step. It identifies the right relationships, preserves their conversations, and produces data that an operator or a downstream analysis workflow can use. It does not send outreach or make lending decisions.

## 02. Scope and build approach

**On screen:** A complete integration slice, with evidence at every boundary

I approached the challenge as a complete integration slice. First, I translated the brief into explicit acceptance criteria: real account connections, natural-language interpretation, deterministic filtering, full-thread normalization, and an immediately available CSV.

I separated domain rules from provider adapters, storage, and the interface. I used AI-assisted development to accelerate implementation and review, then validated behavior with automated tests and real accounts. Mocks supported repeatable failure tests, but they were not the definition of done.

The live corpus is deliberately fictional: twenty contacts, twenty companies, eight deals, and fifty-nine Gmail messages across twenty-one threads. Historical dates make time-window behavior testable. The records really exist in Gmail and HubSpot. A separate guarded seed writer created them without sending email, and replay preserved the original identifiers without duplication.

## 03. The operator interface

**On screen:** Define → review → run → inspect → export

The interface has three main areas. Audience builder defines and executes a segment. Run history returns to saved requests and results. Connections shows the live integration state and setup controls.

The current demonstration uses real Gmail OAuth and a HubSpot private-app token. The normal application connections are read-only. The seed writer is a separate development tool with separate authorization.

In the builder, I enter the challenge request: pull Sponsor contacts who sent emails to the lender in the last two years, excluding the latest three months, and who have not closed a deal in HubSpot.

The first action is Interpret request. It does not immediately scan the mailbox. It produces a reviewable statement of the criteria, so the operator can see the policy before starting the export.

## 04. Constrained AI interpretation

**On screen:** The model proposes structured intent; code owns the policy

The language model translates the request into a constrained, schema-validated intent. It is not given CRM records or email bodies. It has no database or provider tools and does not generate executable queries.

Server code resolves the intent into a frozen specification. Sponsor is an exact CRM property match. An inbound message must come from the contact, with the lender among its recipients. The calendar-month window is evaluated in UTC, with an inclusive start and exclusive end.

Closed a deal means a currently Closed Won deal directly associated with the contact, across all time. Closed Lost remains eligible. These are explicit assumptions, not hidden guesses.

The administrator reviews those rules before selecting Run segment. Unsupported conditions are rejected instead of silently dropped. AI handles the language boundary; deterministic code owns the decision.

## 05. Architecture and execution

**On screen:** A durable job connects the interface to provider work

The application uses Next.js and strict TypeScript, with a provider-independent domain layer. PostgreSQL stores requests, jobs, canonical entities, relationships, and export results. A separate long-running worker performs live ingestion outside the browser request.

When the operator runs a segment, the application saves the request and queues a job. The worker claims it with a lease, reports progress, and uses ownership checks when publishing results. The user can leave the page and return through history.

HubSpot supplies contacts, companies, deals, and explicit associations. The application filters CRM candidates, retrieves the relevant Gmail conversations within the approved data boundary, and evaluates exact identity and timestamp conditions locally.

This keeps the user interface responsive and gives the workflow a recoverable, inspectable state. It also avoids tying a potentially long integration job to one HTTP request.

## 06. The verified live result

**On screen:** 20 scanned → 10 contacts → 12 conversations → 45 messages

Here is the actual expanded live result. Twenty contacts were scanned. Ten contacts qualified, producing twelve conversation rows containing forty-five messages. Ten contacts were excluded, and the run reported zero failures. The measured queue-inclusive execution time was twenty-two point eight six nine seconds.

The distinction between contacts and rows matters. Elena Voss at Alder Crest and Marcus Finch at Harbor Lantern each have two separate conversations. One contact with two threads produces two rows, rather than flattening unrelated conversations together.

The exclusion breakdown is also explainable: two contacts are not Sponsors, three have Closed Won deals, and five have no qualifying inbound activity. Those last cases include recent-only, too-old, outbound-only, and no-email scenarios.

These results were compared against an independent expected truth set, including exact contact-thread pairs and message membership, not just the aggregate counts.

## 07. Conversation completeness

**On screen:** Eligibility uses matching messages; context keeps the full thread

Opening a conversation shows why normalization matters. The Alder acquisition thread contains two historical inbound messages that qualify, a lender response, and a recent follow-up outside the matching window.

The recent message does not establish eligibility, but it remains part of the exported conversation. Removing it would lose the current state of the relationship. The interface makes the distinction between qualifying messages and total preserved messages visible.

The normalized structure includes sender and recipients, timestamps, direction, readable text, chronological position, and attachment metadata. The example also includes a synthetic analyst copied on a message and a small fictional attachment. Binary attachment contents are not included in the export.

Identity matching uses normalized email addresses and explicit CRM associations. It does not guess that two people are the same from similar names or ask the model to infer their role.

## 08. Export and traceability

**On screen:** Human-readable context and machine-readable structure

The CSV is the deliverable, not an afterthought. Each row represents a contact and conversation pair. Its eight columns include the subject, full conversation text, account, first and last names, email address, last activity date, and normalized communication JSON.

The downloaded live file was parsed and verified: twelve rows and forty-five normalized messages, with all required headers. Its bytes matched the serialization stored for that run. CSV quoting and formula protection are covered by tests.

Run history preserves the original request and its results. This lets an operator explain what was requested and inspect the corresponding output later. Stable provider identifiers support repeat ingestion and deduplication. An opaque attachment retrieval handle can change between separate provider reads, so semantic repeatability is a more honest claim than universal byte-for-byte equality.

## 09. Security and data boundaries

**On screen:** Keep source data out of the language-model path

Security is central when an integration connects to systems of record. OAuth exchange and token refresh stay on the server, and provider tokens are encrypted at rest in the application database. Live routes require administrator authentication. Provider data is validated, email HTML is sanitized, and remote tracking content is not rendered.

For this mixed-use test mailbox, the application additionally restricts processing to a private receipt containing the exact approved seed identifiers. The Gmail permission itself is mailbox-wide; the receipt is an application-enforced boundary, not a claim of narrower OAuth access.

Only the operator's request is sent to the model. That reduces data exposure, but it does not replace contractual retention, training, or hosting requirements. Client-specific model hosting, formal agreements, enterprise identity, and tenant isolation would need explicit production design and review.

## 10. Tradeoffs and next steps

**On screen:** Practical integration engineering, with honest limits

The main tradeoff was to deliver one complete, defensible workflow before broadening the product. Gmail and free HubSpot satisfy the initial proof-of-concept slice. Additional providers, continuous synchronization, generalized agents, and outreach automation were deliberately left for later.

Fresh snapshots and sequential provider reads favor clarity and correctness at this size. Production work would include batching and bounded concurrency, quotas, stronger observability, per-tenant authorization, retention controls, and more extensive recovery and scale testing. The measured runtime is evidence for this small corpus, not a throughput guarantee.

The code passed two hundred and sixty-four automated tests, browser and API checks, and separate-worker PostgreSQL verification. Real account tests additionally proved interpretation, ingestion, normalization, and the downloaded CSV.

The outcome is a useful integration foundation: a reviewable request, deterministic selection, complete communication context, and a traceable export. That is the practical automation story I would carry into Plum's managed-service environment.
