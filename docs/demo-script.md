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

## Live demonstration after acceptance

Follow the owner-approved procedure in `live-acceptance.md`. Show the **Live data** label and connected provider status while avoiding account identities in shared recordings. Review the exact interpreted criteria before the owner starts ingestion. Compare results to independently known cases and download privately. Do not present synthetic screenshots or counts as evidence of a live run.

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
