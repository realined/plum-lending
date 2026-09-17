# Live presentation runbook

Use this for the review itself. The narrated video is a practice companion and fallback; the running app is the primary evidence. Keep the tested implementation frozen. Do not run builds or restart services immediately before the meeting.

## Opening: 60 seconds

“Plum's problem here is joining relationship context across systems. HubSpot can tell us who is a Sponsor and whether an associated deal is Closed Won. Gmail can tell us whether that person contacted the lender and what the conversation contains. This application takes a plain-language request, makes its assumptions visible, applies deterministic rules to both real services, and exports complete normalized conversations. I scoped the first version to the candidate-email plus free-HubSpot slice in the brief. The data is fictional, but the OAuth, provider reads, model interpretation, background job and CSV are real.”

## Primary live sequence: about 6–8 minutes

| Step | Action | What to say / prove |
| --- | --- | --- |
| 1 | Open the already-successful expanded run | “This is the expected end state: 10 contacts, 12 conversations, 45 messages, 10 exclusions and zero failures.” Start with the outcome, then explain the flow. |
| 2 | Open Connections; avoid destructive buttons | Gmail and HubSpot are connected. Normal readers are read-only. Configuration checks are local shape checks; the successful run is the actual integration proof. Do not expose credentials. |
| 3 | Return to Audience builder → New segment → Use example request | Read the challenge request. Only this query goes to the model. The page is not a general chatbot or arbitrary query engine. |
| 4 | Click Interpret request | Point out OpenAI structured-output provenance. Explain exact Sponsor classification, contact-sent inbound mail, UTC inclusive/exclusive date boundaries and direct current Closed Won semantics. Closed Lost is allowed. |
| 5 | Review, then click Run segment | The request becomes a durable PostgreSQL job. The separate worker performs provider work. Show the progress. The verified prior run took 22.869 seconds; do not promise the next call has identical latency. |
| 6 | Show results and expand exclusions | Expect 20 scanned, 10 included, 12 threads, 45 messages, 10 exclusions, zero failures. Two non-Sponsors, three Closed Won, five no qualifying inbound. |
| 7 | Point to Alder and Harbor appearing twice | They are two separate threads for each contact, not duplicate contact ingestion. The export granularity is a contact/thread pair. |
| 8 | Open Alder acquisition | Two matching inbound messages qualify; all four messages remain. Point out the recent reply, synthetic CC and attachment metadata. Do not open raw provider IDs on a public recording. |
| 9 | Download CSV | Show eight headers and the distinction between readable full conversation text and normalized JSON. Keep the live download private; its recipient fields include the lab mailbox. |
| 10 | Open Run history, then return to the completed result | Requests and saved results are traceable. The frozen specification belongs to that saved run. |

## Explain the source data honestly

The real service corpus contains 20 contacts, 20 companies, 8 deals, 21 threads and 59 messages. A separate guarded writer inserted historical fictional messages and created CRM records. It did not send email. All original IDs were preserved during expansion; replay passed without duplicates.

If asked to prove the messages exist, use only the approved Gmail account and the exact search `in:anywhere label:bentech-lending-poc-v1`. The messages are under that label, not Inbox. Do not open unrelated mail. Do not call the imported historical dates naturally accumulated correspondence.

## Architecture explanation: 2 minutes

1. Next.js/TypeScript handles the administrator interface and API.
2. The parser sends only query text and policy instructions to OpenAI. Strict schema validation produces constrained intent; server code freezes policy/date semantics.
3. PostgreSQL persists requests, job state, connections, canonical entities, associations and results.
4. A separate worker claims leased jobs, reads provider snapshots and publishes only while it owns the job.
5. HubSpot/Gmail adapters retrieve and validate provider data. The domain layer owns identities, dates, eligibility, normalization and CSV.
6. The UI polls durable state, previews a page of results, exposes full-thread inspection and downloads the CSV.

## Why these choices

- A narrow complete integration slice proves the challenge without adding unrelated providers or autonomous agents.
- Deterministic eligibility makes results explainable and independently testable.
- PostgreSQL for both persistence and the small durable queue avoids another infrastructure dependency; a larger production workload may justify specialized queueing.
- Separate provider adapters isolate API quirks from business rules.
- Snapshot reads are simple and current per run. Continuous history/webhook sync is a later scale optimization, not a completed feature.
- A private seed receipt protects this mixed-use mailbox at the application boundary. It does not narrow Gmail's mailbox-wide OAuth grant.

## Preflight before the meeting

- Confirm the local app opens and the worker shows a recent heartbeat. Do not rebuild while presenting.
- Keep the successful expanded run accessible in history as the fallback.
- Confirm you can open the local video and script without network access.
- Keep `.env`, `.env.seed`, OAuth screens, billing pages, raw receipts and unrelated mail out of the screen share.
- Do not click Disconnect & delete or Delete data.
- Model use remains within the previously approved $1 allowance. No account purchases or new permissions are needed for rehearsal.

## Failure fallback

If interpretation/provider access is unavailable, say so directly: “The live provider is unavailable right now. Here is the previously verified live run and its recorded evidence.” Show saved history and the narrated capture. Do not relabel the credential-free demo as live. The offline demo has different fixture counts: 3 contacts, 4 threads and 11 messages.

If a result is partial, explain the incomplete status; do not present it as complete or infer absence from a failed retrieval. Privacy-boundary violations should abort publication, not become partial exports.

## Close: 20 seconds

“The POC delivers the requested join between CRM business context and complete email history. The next production work is tenant and identity controls, retrieval concurrency, quotas, observability and realistic recovery/scale tests. I would integrate those boundaries with the team's existing tools rather than recreate infrastructure already in place.”
