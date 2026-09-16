# Explicit assumptions

1. Sponsor means an exact, case-insensitive value in a configured HubSpot contact property (default `contact_type`, value `Sponsor`). No inference from job titles or email text.
2. Sent emails means the contact is the From identity and a configured lender mailbox/alias occurs in To, CC, or BCC. Lender replies alone never qualify. Plus-tags and dots are not stripped.
3. Calendar arithmetic in UTC: [as-of minus 24 months, as-of minus 3 months). Start is inclusive, end exclusive. Month-end is clamped. The as-of instant is frozen when interpretation is created, not when a worker eventually runs.
4. A closed deal means a currently Closed Won stage, across all directly associated contact deals and all pipelines, at any time. Closed Lost is allowed. Company-only deals do not disqualify all company employees. Historical transitions to Won followed by reopening are outside this slice.
5. Unknown pipeline stages or incomplete deal/association reads exclude affected contacts as failures rather than proving absence of a closed deal.
6. Each row is a unique contact/thread pair. A matching inbound message qualifies the thread; every accessible message in that thread is retained, including older and newer context. Shared threads can produce multiple contact rows.
7. Last Activity Date is the latest message timestamp in the full thread. It can be outside the qualifying window. Attachment metadata is preserved; binary attachments are not downloaded. Gmail may omit BCC or deleted messages; the application cannot reconstruct content the provider does not expose.
8. The public reference was read only at `Sheet1!A1:H1`. It contains `Email Body`; we retain that exact header. No real correspondence was inspected or copied. All demo names, companies, and messages are invented.
9. Demo uses a frozen 2026-09-16T12:00:00Z clock for repeatability and a deliberately bounded local parser. Live interpretation uses OpenAI structured output, with explicit unsupported requests rejected.
10. This is a single administrator, single mailbox, single CRM POC. Shared authentication is a baseline, not enterprise RBAC. Live mode requires auth and PostgreSQL; no live data is mixed into demo fixtures.

Sources reviewed: [challenge](https://summit-slate-w5z5.here.now/), [reference headers](https://docs.google.com/spreadsheets/d/1fxXHszu0RzbYXFjl9EfjLbHbV4ni58ByazY82FuxTec/edit).

11. Gmail candidate search includes Spam and Trash as well as ordinary folders, to avoid silently narrowing “all contacts who sent emails.” Full-thread retrieval preserves all messages Gmail exposes; permanently deleted content cannot be recovered.
