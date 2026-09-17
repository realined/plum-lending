# Demo script

## Three-minute synthetic walkthrough

1. Start the documented demo and call out the **Demo environment** label. Explain that this is a synthetic resilience demonstration, separate from mandatory live acceptance.
2. Read the representative request. Select **Interpret request**. Explain the exact Sponsor field, inbound sender/recipient condition, UTC window, and direct Closed Won rule.
3. Select **Run segment**. Explain that the request returns a saved job ID and a worker processes it outside the HTTP request.
4. Show **3 contacts, 4 threads, 11 messages, 5 exclusions, 0 failures**. The four rows demonstrate that one contact can have multiple threads.
5. Inspect **Juniper Park · acquisition financing**. Highlight older context before the window, a matching contact message, a lender reply, and a recent update after the cutoff. Eligibility uses matching messages; context includes all of them.
6. Open the normalized JSON, then close the drawer and download the CSV. Show the eight compatible columns and populated subject/body. No email content went to a model.
7. Run the partial scenario. Explain that successful rows remain available and the export is visibly incomplete. Then demonstrate the empty or outage scenario if time permits.
8. Open Run history and return to a previous result.

## Verified live demonstration — primary presentation path

1. Open the local app and identify **Live data**. Gmail and HubSpot are connected. Explain that this is fictional test data inserted into real services, with a receipt boundary excluding unrelated mail.
2. Choose **New segment** and use the representative challenge sentence. Click **Interpret request** and point out **OpenAI structured output**. Explain exact Sponsor matching, inbound direction, the frozen UTC 24-minus-3-month window, direct currently Closed Won exclusion, and Closed Lost inclusion.
3. Click **Run segment**. Explain that the database queue and separate worker continue independently of the page. The expanded live run took 22.869 seconds on this small corpus; do not promise that latency at scale.
4. Show **10 contacts, 12 threads, 45 messages, 10 exclusions, 0 failures**. Exclusions are 2 non-Sponsors, 3 Closed Won, and 5 without qualifying inbound email. Alder and Harbor each have two distinct conversations, explaining twelve rows for ten contacts.
5. Open Cedar Gate’s four-message conversation. Point to the two historical qualifying inbound messages, the lender replies, recent August context beyond the cutoff, CC and attachment metadata. Show the normalized JSON briefly without recording account/provider identifiers.
6. Download the CSV privately. It has 8 required columns and 12 contact/thread rows. Full text and machine-readable normalized JSON remain together. No mailbox content was sent to the language model.
7. Open **Run history** to demonstrate durable saved results. Mention repeated reads preserve canonical entity counts; an opaque Gmail attachment retrieval ID can change between runs.
8. Close with evidence: 264 automated tests plus real provider/AI/browser acceptance; production next steps are bounded retrieval, observability and refresh/queue recovery—not more providers for this POC.

The earlier three-minute demo-mode script is the labeled offline fallback, with different fixture counts. Never present its 3-contact/4-thread results as the live dataset. Rehearsal remains owner-operated; budget for new interpretation calls is shared with the approved $1 limit.

## Expected synthetic truth set

| Case | Outcome |
| --- | --- |
| Avery / Juniper | Two eligible threads; one preserves both old and recent context |
| Jordan / Northline | Included; prior Closed Lost deal does not exclude |
| Casey / Cedar House | Included; message exactly at inclusive start boundary |
| Riley / Harborstone | Excluded by directly associated Closed Won deal |
| Quinn / Willow Ridge | Excluded because contact is Broker |
| Drew / Atlas | Excluded; message exactly at exclusive end boundary |
| Taylor / Summit | Excluded; only lender-originated mail |
| Alex / Bridgepoint | Excluded; message one second before start |

All names and messages above are invented. Addresses use example.test.
