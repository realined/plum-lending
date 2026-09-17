# Expanded live demo acceptance

Verified September 16, 2026 Eastern, after owner approval of the exact additive writes. The normal application is running in live mode and the completed expanded audience is open for review.

## Actual outcome

| Check | Result |
| --- | --- |
| Real source corpus | 20 contacts, 20 companies, 8 deals; 21 Gmail threads, 59 messages |
| Original records | All original contact/company/deal/message IDs preserved |
| Seed replay | Passed; no duplicates or pending uncertain writes |
| Independent Gmail check | Seed label reports 59 messages and 21 threads |
| Real OpenAI interpretation | Browser shows structured-output provenance and correct reviewed criteria |
| Real reader result | 20 scanned; 10 included contacts; 12 threads; 45 messages; 10 excluded; 0 failures |
| Exclusion groups | 2 non-Sponsors; 3 Closed Won; 5 without qualifying inbound email |
| Queue-inclusive runtime | 22.869 seconds on this controlled corpus |
| Identity/content checks | Exact expected contact/thread pairs and message membership; normalized schema and chronological order pass |
| Canonical storage | 20 contacts, 20 companies, 8 deals, 12 matched threads, 45 messages; 20 contact-company and 8 contact-deal associations |
| Actual downloaded CSV | 8 exact headers, 12 rows, 45 normalized messages; bytes match this run's stored serialization |
| Local verification | 264 tests across 9 files, lint, strict types and production build pass |
| GitHub CI | Code commit 4bf2d3a, run 35177756338: success; 11 browser/API tests plus native PostgreSQL separate-worker verification |

Two qualifying contacts, Elena Voss/Alder Crest and Marcus Finch/Harbor Lantern, each have two separate conversations. They explain why ten contacts produce twelve CSV rows. Alder's four-message acquisition drawer was inspected: two historical qualifying inbound messages, historical lender reply, recent August follow-up, analyst CC and synthetic attachment. The recent reply stays in the export as context even though it does not qualify the contact.

## Implementation and data flow

`src/seed/plan.ts` defines the fixed expanded fictional corpus; explicit conversation keys separate contact identity from thread identity. `writer.ts` verifies the original complete dataset and exact thread grouping, while `cli.ts` backs up the private base journal before the approved transition. Every original ID is compared during replay. The protected reader receipt is published only after complete provider verification. `scripts/seed-preview.ts` exposes the offline expanded dry-run. `tests/seed-plan.test.ts` covers normalization/filter/CSV truth sets, preservation, replay, interrupted creates and crossed thread membership.

The app's flow is unchanged: natural-language request → schema-validated criteria → owner review → PostgreSQL job → separate worker → read-only HubSpot/Gmail snapshots → deterministic eligibility → full-thread normalization → preview/CSV. The model receives the request only, never email or CRM records.

An additive migration was selected over deleting/reseeding to preserve proven provider IDs. Exact thread-key/provider-ID correspondence was selected over count-only checks because crossed conversations can retain the same counts. Interrupted creates stop for inspection instead of automatic retry and possible duplication.

## Live versus mocked, privacy and limits

Positive consent, insertion, associations, replay, interpretation, ingestion and CSV paths are verified on real accounts. Automated adversarial/failure/cleanup tests use fictional responses. No mail was sent, existing data deleted, or unrelated email read. The dedicated label contains historical inserted messages; these are real stored messages with invented content, not organically received mail. Search `in:anywhere label:bentech-lending-poc-v1` in the approved lab Gmail account.

Credentials, OAuth tokens, provider IDs, private migration receipts and downloaded CSV stay outside Git. Normal readers remain read-only. The writer's short-lived grant and explicit enable flag remain separate. No new scope or cleanup authorization was introduced.

This small dataset is not a production-scale benchmark. Continuous sync, broader model evaluation, provider concurrency and live destructive cleanup are not claimed complete. Partial-error explanation and loading/queue copy remain recorded improvements. The reported Build an audience error occurred during a stopped web process; after restart, two fresh real OpenAI browser interpretations and live runs succeeded. Future maintenance should be announced before stopping the app.

## Interview talking points and remaining work

Be ready to explain: constrained AI interpretation versus deterministic decisions; contact versus conversation identity; qualifying messages versus complete context; idempotency versus uncertain-write recovery; and receipt-based mailbox isolation.

No credential or data action is currently required from the owner. Next: review the larger audience, rehearse the source → criteria → result explanation, and decide the remaining small usability refinements. The overview video/script and ElevenLabs narration remain explicitly deferred until final readiness approval. No media generation or ElevenLabs credits were used.
