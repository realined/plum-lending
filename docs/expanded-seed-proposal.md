# Additive synthetic lending dataset proposal

**Owner approved this 20-contact scope. Implementation, offline validation, approved live writes/replay and expanded browser/CSV acceptance pass. See `expanded-live-acceptance.md`.** Preserve every existing record and provider ID in the current seven-contact dataset. Expand it with fictional lending conversations that make filtering, context retention, and one-contact/multiple-thread behavior easy to demonstrate. The existing protected mailbox boundary remains mandatory.

## Counts and acceptance contract

| Entity | Existing | Add | Final |
| --- | ---: | ---: | ---: |
| Contacts | 7 | 13 | 20 |
| Companies | 7 | 13 | 20 |
| Deals | 3 | 5 | 8 |
| Gmail threads | 6 | 15 | 21 |
| Gmail messages | 9 | 50 | 59 |
| Contact-company associations | 7 | 13 | 20 |
| Contact-deal associations | 3 | 5 | 8 |
| Included contacts | 2 | 8 | 10 |
| Contact/thread export rows | 2 | 10 | 12 |
| Messages in exported threads | 5 | 40 | 45 |
| Excluded contacts | 5 | 5 | 10 |

These expected results apply to the representative Sponsor + inbound + 24-calendar-month lookback excluding 3 recent months + no directly associated currently Closed Won deal request, evaluated around the September 2026 presentation. The seeded dates are fixed; expectations must be reevaluated before a substantially later presentation. Expected aggregate exclusions: 2 non-Sponsors, 3 with Closed Won deals, and 5 with no qualifying inbound message. Zero provider failures expected.

## Safe identity convention

Keep the approved namespace `bentech-lending-poc-v1`. Each new contact uses `<key>.bentech-lending-poc-v1@example.com` (the reserved domain already accepted by HubSpot). For example: `alder.bentech-lending-poc-v1@example.com`. Each company uses `<key>.bentech-lending-poc-v1.example.test`. Every identity below is fictional. Prefix every subject with `[bentech-lending-poc-v1] `, retain namespace headers, and use unique RFC Message-IDs under `example.test`.

The existing mailbox identity is supplied privately at execution, never written into this proposal. Contact-to-company associations are one-to-one; deals are directly associated with their corresponding contact. Do not enable HubSpot automatic company association. No message is sent to an external recipient.

## New records

| Key | Fictional contact | Fictional company | Role | Direct deal | Expected |
| --- | --- | --- | --- | --- | --- |
| alder | Elena Voss | Alder Crest Partners | Sponsor | Open | Include; 2 threads |
| harbor | Marcus Finch | Harbor Lantern Capital | Sponsor | Open | Include; 2 threads |
| maple | Nora Ellis | Maple Terrace Ventures | Sponsor | Closed Lost | Include; 1 thread |
| copper | Julian Hart | Copper Brook Holdings | Sponsor | None | Include; 1 thread |
| summit | Camille Frost | Summit Orchard Partners | Sponsor | None | Include; 1 thread |
| river | Adrian Wells | River Slate Capital | Sponsor | None | Include; 1 thread |
| oak | Tessa Lane | Oak Lantern Ventures | Sponsor | None | Include; 1 thread |
| pine | Simon Blake | Pine Meadow Holdings | Sponsor | None | Include; 1 thread |
| stone | Vivian Holt | Stone Orchard Partners | Sponsor | Closed Won | Exclude: won |
| bay | Ethan Cole | Bay Timber Capital | Sponsor | Closed Won | Exclude: won |
| reed | Clara Hayes | Reed Valley Advisors | Broker | None | Exclude: role |
| elm | Lucas Gray | Elm Harbor Ventures | Sponsor | None | Exclude: outbound only |
| ash | Maya Quinn | Ash Terrace Partners | Sponsor | None | Exclude: recent only |

The five new deal records are exactly two Open, one Closed Lost, and two Closed Won. Resolve these statuses using the existing approved portal pipeline/stage metadata; do not guess status from display names or create new stages.

## Message date patterns

All times below are UTC and fixed. Historical messages are well inside the representative window and recent replies demonstrate full-thread preservation.

- **H18 / H12 / H6:** begin six days before the frozen reference time minus 18, 12 or 6 calendar months; contact → lender on day zero, lender → contact on day one, contact → lender on day two, then a lender follow-up one calendar month before the reference time.
- **E12:** the first two historical messages at the 12-month pattern; CRM role/deal criteria exclude these contacts.
- **OUT:** two lender-to-contact messages at the 12-month pattern; no inbound response.
- **RECENT:** contact inquiry and lender response six and five days before the one-month-prior reference time; both inside the excluded recent period.

The generated dry-run is authoritative for exact timestamps and the complete plan digest. This relative construction keeps the fixture reusable while preserving every original seeded record. For the approved frozen September 2026 plan, all dates remain safely away from eligibility boundaries.

H patterns each contain four messages: two qualifying inbound messages, one historical lender response, and one recent lender response. The exported recent response is context, not an eligibility trigger. Last Activity Date will be in August 2026 even though qualifying inbound activity is older. All separate threads use distinct subjects and RFC roots, with explicit reply chains to prevent accidental thread merging.

## Exact new thread plan and story beats

The subjects shown below omit the mandatory namespace prefix for readability. Each semicolon-separated beat is one message in the stated chronological order. Monetary figures are invented scenario detail, not additional filters or financial recommendations.

| Contact key / thread key | Exact subject after prefix | Pattern | Four-message story (two for excluded cases) |
| --- | --- | --- | --- |
| alder / alder-acquisition | Alder Crest apartments acquisition | H18 | Elena requests acquisition financing for a fictional 48-unit apartment property at a $7.2m purchase price; lender asks for rent roll and operating history; Elena supplies occupancy and renovation assumptions with synthetic attachment metadata; lender asks in August whether the acquisition plan is still active. |
| alder / alder-renovation | Alder Crest renovation reserve discussion | H6 | Elena asks about financing a $650k renovation reserve; lender requests scope and schedule; Elena provides unit-turn timing and contingency assumptions; lender follows up in August on revised contractor bids. |
| harbor / harbor-refinance | Harbor Lantern industrial refinance | H12 | Marcus requests refinance options for a fictional small industrial campus; lender requests maturity date and lease summary; Marcus provides a hypothetical November maturity and tenant schedule; lender follows up in August about updated occupancy. |
| harbor / harbor-expansion | Harbor Lantern warehouse expansion | H6 | Marcus asks about a warehouse expansion next to the campus; lender asks whether land is controlled and plans are approved; Marcus explains the option agreement and preliminary permit schedule; lender checks in during August on planning progress. |
| maple / maple-retail | Maple Terrace retail acquisition review | H18 | Nora requests acquisition financing for a fictional neighborhood retail center; lender asks about tenant concentrations; Nora provides a synthetic leasing summary; lender asks in August whether a replacement opportunity is available after the original transaction did not proceed. Closed Lost is intentionally allowed. |
| copper / copper-bridge | Copper Brook bridge financing inquiry | H12 | Julian asks about bridge financing during an office-to-flex repositioning; lender asks for milestones and exit plan; Julian explains the hypothetical construction schedule and refinance assumptions; lender follows up in August on completed milestones. |
| summit / summit-multifamily | Summit Orchard multifamily financing | H6 | Camille requests financing for a fictional 32-unit apartment acquisition; lender asks for property operations and equity contribution; Camille provides a synthetic operating summary and equity plan; lender checks in during August on the purchase timeline. |
| river / river-storage | River Slate self-storage refinance | H18 | Adrian asks about refinancing a fictional self-storage property; lender requests occupancy and trailing operations; Adrian provides a synthetic occupancy trend and capital-improvement summary; lender asks in August whether updated results are available. |
| oak / oak-medical | Oak Lantern medical office acquisition | H12 | Tessa requests financing for a fictional medical office acquisition; lender asks about lease expirations and tenant mix; Tessa provides hypothetical lease terms and acquisition timing; lender follows up in August on diligence progress. |
| pine / pine-townhomes | Pine Meadow townhome construction inquiry | H6 | Simon asks about financing a fictional 18-home rental development; lender asks for approvals, budget and completion timeline; Simon provides a synthetic cost summary and entitlement schedule; lender checks in during August on revised timing. |
| stone / stone-refinance | Stone Orchard completed refinance | E12 | Vivian requests terms for a fictional multifamily refinance; lender acknowledges the submitted information. The associated current Closed Won deal disqualifies the contact regardless of the qualifying email. |
| bay / bay-acquisition | Bay Timber warehouse acquisition request | E12 | Ethan asks about financing a fictional warehouse purchase; lender requests remaining diligence documents. The associated current Closed Won deal disqualifies the contact. |
| reed / reed-broker | Reed Valley financing introduction | E12 | Clara introduces a fictional financing opportunity in her capacity as broker; lender acknowledges the referral. The CRM role is Broker, so the contact is excluded even though the email qualifies. |
| elm / elm-outreach | Elm Harbor lender outreach | OUT | Lender asks Lucas whether a financing review would be useful; lender sends a second brief follow-up. Lucas never replies, so outbound activity alone cannot qualify him. |
| ash / ash-recent | Ash Terrace new financing inquiry | RECENT | Maya requests financing information for a fictional property; lender acknowledges and requests details. Activity is entirely within the excluded recent period. |

For included stories, write short substantive bodies (short readable paragraphs), retaining quoted context only where it adds clarity. The MIME renderer produces plain text plus HTML alternatives. The Alder acquisition thread adds one clearly fictional text attachment and synthetic analyst CC, preserving the existing Cedar attachment behavior. Do not add attachments to every message or introduce arbitrary new feature requirements. Named-recipient groups are covered by separate automated regression tests; this corpus uses individual addresses.

## Additive migration implementation constraints

The writer now supports explicit thread keys while preserving the original fallback. Its changed-plan journal guard still rejects arbitrary mismatched digests. The expansion command verifies the original dataset, saves its private journal, and checks preserved IDs before applying the approved additions.

1. Make thread identity independent of contact identity in the seed plan and writer. Retain every original contact, company, deal, message, RFC ID, subject, timestamp, thread mapping and label exactly. Existing data must remain byte-equivalent at the planned-content level.
2. Validate that the current journal/receipt corresponds to the known original base-plan digest and approved target. Re-read only approved IDs to confirm the original live records, associations, message membership and namespace are intact. Abort on unknown records, mismatches, pending operations or an unexpected digest.
3. Review the exact additive plan and dry-run with the owner. No expanded live writes are authorized by this proposal. Keep the separate writer token and normal read-only application connection unchanged.
4. Store a private migration receipt containing base and expanded digest, preserved IDs, and incremental progress. Back up private state without exposing account identities or credentials. Preserve the existing idempotency and uncertain-write stop rules.
5. Quiesce application workers/exports during the approved additive write operation. Create only the 13 contacts, 13 companies, 5 deals, 15 threads and 50 messages listed above. Reuse all original IDs and the seed label. Associate only reviewed contact/company/deal pairs.
6. Publish an expanded protected-reader receipt only after verifying exact final membership: 20/20/8 CRM entities, 21 threads and 59 messages. An unfinished migration must never widen the reader allowlist to unverified data.
7. Replay the expanded plan and verify no extra records or messages and stable original IDs. Run the normal read-only representative export and compare exact contact/thread identities privately, not just aggregate counts. Confirm 10 contacts, 12 rows, 45 normalized messages, 10 exclusions and zero failures.
8. Record only counts, pass/fail, timings and sanitized categories in source-controlled evidence. Keep live IDs, mailbox identity, tokens and live CSV outside the repository. Cleanup remains separately authorized; no existing data is removed by expansion.

## Demo payoff

The broader dataset demonstrates that results are not a two-row special case: two Sponsors appear twice because each has two separate conversations; Closed Lost remains eligible; Closed Won, Broker, outbound-only and recent-only examples fail for different explainable reasons; recent lender replies remain in complete exported threads. It remains a small controlled dataset, so runtime measurements must not be extrapolated into production-scale guarantees.
