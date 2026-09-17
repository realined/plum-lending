# Fictional live dataset — offline dry-run

No credentials loaded, provider requests made, or live records written.
Namespace: bentech-lending-poc-v1
Frozen reference time: 2026-09-16T12:00:00.000Z
Qualifying window: 2024-09-16T12:00:00.000Z inclusive to 2026-06-16T12:00:00.000Z exclusive.
Plan SHA-256: 391c8c29010c5209ac631c4bfaa7b7976cf158cc85ed324a7c4bf0b5c6990ac2

| Contact | Company | Role | Deal | Expected | Reason |
| --- | --- | --- | --- | --- | --- |
| Mira Vale | [bentech-lending-poc-v1] Cedar Gate Partners | Sponsor | open | include | Historical inbound activity; open deal |
| Owen Reed | [bentech-lending-poc-v1] Granite Harbor Capital | Sponsor | won | exclude | Closed Won deal |
| Lena Park | [bentech-lending-poc-v1] Juniper Row Partners | Sponsor | none | exclude | Activity only within the most recent three months |
| Nolan Brook | [bentech-lending-poc-v1] Old Mill Ventures | Sponsor | none | exclude | Activity older than two years |
| Iris Stone | [bentech-lending-poc-v1] Silver Birch Advisors | Broker | none | exclude | Not a Sponsor |
| Theo Marsh | [bentech-lending-poc-v1] Willow Court Holdings | Sponsor | lost | include | Historical inbound activity; Closed Lost is allowed |
| Aria Quinn | [bentech-lending-poc-v1] North Meadow Partners | Sponsor | none | exclude | No matching email communication |
| Elena Voss | [bentech-lending-poc-v1] Alder Crest Partners | Sponsor | open | include | Historical inbound activity; no Closed Won deal |
| Marcus Finch | [bentech-lending-poc-v1] Harbor Lantern Capital | Sponsor | open | include | Historical inbound activity; no Closed Won deal |
| Nora Ellis | [bentech-lending-poc-v1] Maple Terrace Ventures | Sponsor | lost | include | Historical inbound activity; no Closed Won deal |
| Julian Hart | [bentech-lending-poc-v1] Copper Brook Holdings | Sponsor | none | include | Historical inbound activity; no Closed Won deal |
| Camille Frost | [bentech-lending-poc-v1] Summit Orchard Partners | Sponsor | none | include | Historical inbound activity; no Closed Won deal |
| Adrian Wells | [bentech-lending-poc-v1] River Slate Capital | Sponsor | none | include | Historical inbound activity; no Closed Won deal |
| Tessa Lane | [bentech-lending-poc-v1] Oak Lantern Ventures | Sponsor | none | include | Historical inbound activity; no Closed Won deal |
| Simon Blake | [bentech-lending-poc-v1] Pine Meadow Holdings | Sponsor | none | include | Historical inbound activity; no Closed Won deal |
| Vivian Holt | [bentech-lending-poc-v1] Stone Orchard Partners | Sponsor | won | exclude | Closed Won deal |
| Ethan Cole | [bentech-lending-poc-v1] Bay Timber Capital | Sponsor | won | exclude | Closed Won deal |
| Clara Hayes | [bentech-lending-poc-v1] Reed Valley Advisors | Broker | none | exclude | Not a Sponsor |
| Lucas Gray | [bentech-lending-poc-v1] Elm Harbor Ventures | Sponsor | none | exclude | Outbound only |
| Maya Quinn | [bentech-lending-poc-v1] Ash Terrace Partners | Sponsor | none | exclude | Recent only |

Proposed totals: 20 contacts, 20 companies, 8 deals, 21 threads, 59 messages; 12 expected CSV rows.

| Message key | Direction | Date | RFC Message-ID |
| --- | --- | --- | --- |
| cedar-1 | inbound | 2025-09-16T12:00:00.000Z | &lt;bentech-lending-poc-v1.cedar-1@example.test&gt; |
| cedar-2 | outbound | 2025-09-17T12:00:00.000Z | &lt;bentech-lending-poc-v1.cedar-2@example.test&gt; |
| cedar-3 | inbound | 2025-09-23T12:00:00.000Z | &lt;bentech-lending-poc-v1.cedar-3@example.test&gt; |
| cedar-4 | outbound | 2026-08-16T12:00:00.000Z | &lt;bentech-lending-poc-v1.cedar-4@example.test&gt; |
| granite-1 | inbound | 2025-09-16T12:00:00.000Z | &lt;bentech-lending-poc-v1.granite-1@example.test&gt; |
| juniper-1 | inbound | 2026-08-16T12:00:00.000Z | &lt;bentech-lending-poc-v1.juniper-1@example.test&gt; |
| oldmill-1 | inbound | 2024-03-16T12:00:00.000Z | &lt;bentech-lending-poc-v1.oldmill-1@example.test&gt; |
| birch-1 | inbound | 2025-09-16T12:00:00.000Z | &lt;bentech-lending-poc-v1.birch-1@example.test&gt; |
| willow-1 | inbound | 2025-09-16T12:00:00.000Z | &lt;bentech-lending-poc-v1.willow-1@example.test&gt; |
| alder-acquisition-1 | inbound | 2025-03-10T12:00:00.000Z | &lt;bentech-lending-poc-v1.alder-acquisition-1@example.test&gt; |
| alder-acquisition-2 | outbound | 2025-03-11T12:00:00.000Z | &lt;bentech-lending-poc-v1.alder-acquisition-2@example.test&gt; |
| alder-acquisition-3 | inbound | 2025-03-12T12:00:00.000Z | &lt;bentech-lending-poc-v1.alder-acquisition-3@example.test&gt; |
| alder-acquisition-4 | outbound | 2026-08-16T12:00:00.000Z | &lt;bentech-lending-poc-v1.alder-acquisition-4@example.test&gt; |
| alder-renovation-1 | inbound | 2026-03-10T12:00:00.000Z | &lt;bentech-lending-poc-v1.alder-renovation-1@example.test&gt; |
| alder-renovation-2 | outbound | 2026-03-11T12:00:00.000Z | &lt;bentech-lending-poc-v1.alder-renovation-2@example.test&gt; |
| alder-renovation-3 | inbound | 2026-03-12T12:00:00.000Z | &lt;bentech-lending-poc-v1.alder-renovation-3@example.test&gt; |
| alder-renovation-4 | outbound | 2026-08-16T12:00:00.000Z | &lt;bentech-lending-poc-v1.alder-renovation-4@example.test&gt; |
| harbor-refinance-1 | inbound | 2025-09-10T12:00:00.000Z | &lt;bentech-lending-poc-v1.harbor-refinance-1@example.test&gt; |
| harbor-refinance-2 | outbound | 2025-09-11T12:00:00.000Z | &lt;bentech-lending-poc-v1.harbor-refinance-2@example.test&gt; |
| harbor-refinance-3 | inbound | 2025-09-12T12:00:00.000Z | &lt;bentech-lending-poc-v1.harbor-refinance-3@example.test&gt; |
| harbor-refinance-4 | outbound | 2026-08-16T12:00:00.000Z | &lt;bentech-lending-poc-v1.harbor-refinance-4@example.test&gt; |
| harbor-expansion-1 | inbound | 2026-03-10T12:00:00.000Z | &lt;bentech-lending-poc-v1.harbor-expansion-1@example.test&gt; |
| harbor-expansion-2 | outbound | 2026-03-11T12:00:00.000Z | &lt;bentech-lending-poc-v1.harbor-expansion-2@example.test&gt; |
| harbor-expansion-3 | inbound | 2026-03-12T12:00:00.000Z | &lt;bentech-lending-poc-v1.harbor-expansion-3@example.test&gt; |
| harbor-expansion-4 | outbound | 2026-08-16T12:00:00.000Z | &lt;bentech-lending-poc-v1.harbor-expansion-4@example.test&gt; |
| maple-retail-1 | inbound | 2025-03-10T12:00:00.000Z | &lt;bentech-lending-poc-v1.maple-retail-1@example.test&gt; |
| maple-retail-2 | outbound | 2025-03-11T12:00:00.000Z | &lt;bentech-lending-poc-v1.maple-retail-2@example.test&gt; |
| maple-retail-3 | inbound | 2025-03-12T12:00:00.000Z | &lt;bentech-lending-poc-v1.maple-retail-3@example.test&gt; |
| maple-retail-4 | outbound | 2026-08-16T12:00:00.000Z | &lt;bentech-lending-poc-v1.maple-retail-4@example.test&gt; |
| copper-bridge-1 | inbound | 2025-09-10T12:00:00.000Z | &lt;bentech-lending-poc-v1.copper-bridge-1@example.test&gt; |
| copper-bridge-2 | outbound | 2025-09-11T12:00:00.000Z | &lt;bentech-lending-poc-v1.copper-bridge-2@example.test&gt; |
| copper-bridge-3 | inbound | 2025-09-12T12:00:00.000Z | &lt;bentech-lending-poc-v1.copper-bridge-3@example.test&gt; |
| copper-bridge-4 | outbound | 2026-08-16T12:00:00.000Z | &lt;bentech-lending-poc-v1.copper-bridge-4@example.test&gt; |
| summit-multifamily-1 | inbound | 2026-03-10T12:00:00.000Z | &lt;bentech-lending-poc-v1.summit-multifamily-1@example.test&gt; |
| summit-multifamily-2 | outbound | 2026-03-11T12:00:00.000Z | &lt;bentech-lending-poc-v1.summit-multifamily-2@example.test&gt; |
| summit-multifamily-3 | inbound | 2026-03-12T12:00:00.000Z | &lt;bentech-lending-poc-v1.summit-multifamily-3@example.test&gt; |
| summit-multifamily-4 | outbound | 2026-08-16T12:00:00.000Z | &lt;bentech-lending-poc-v1.summit-multifamily-4@example.test&gt; |
| river-storage-1 | inbound | 2025-03-10T12:00:00.000Z | &lt;bentech-lending-poc-v1.river-storage-1@example.test&gt; |
| river-storage-2 | outbound | 2025-03-11T12:00:00.000Z | &lt;bentech-lending-poc-v1.river-storage-2@example.test&gt; |
| river-storage-3 | inbound | 2025-03-12T12:00:00.000Z | &lt;bentech-lending-poc-v1.river-storage-3@example.test&gt; |
| river-storage-4 | outbound | 2026-08-16T12:00:00.000Z | &lt;bentech-lending-poc-v1.river-storage-4@example.test&gt; |
| oak-medical-1 | inbound | 2025-09-10T12:00:00.000Z | &lt;bentech-lending-poc-v1.oak-medical-1@example.test&gt; |
| oak-medical-2 | outbound | 2025-09-11T12:00:00.000Z | &lt;bentech-lending-poc-v1.oak-medical-2@example.test&gt; |
| oak-medical-3 | inbound | 2025-09-12T12:00:00.000Z | &lt;bentech-lending-poc-v1.oak-medical-3@example.test&gt; |
| oak-medical-4 | outbound | 2026-08-16T12:00:00.000Z | &lt;bentech-lending-poc-v1.oak-medical-4@example.test&gt; |
| pine-townhomes-1 | inbound | 2026-03-10T12:00:00.000Z | &lt;bentech-lending-poc-v1.pine-townhomes-1@example.test&gt; |
| pine-townhomes-2 | outbound | 2026-03-11T12:00:00.000Z | &lt;bentech-lending-poc-v1.pine-townhomes-2@example.test&gt; |
| pine-townhomes-3 | inbound | 2026-03-12T12:00:00.000Z | &lt;bentech-lending-poc-v1.pine-townhomes-3@example.test&gt; |
| pine-townhomes-4 | outbound | 2026-08-16T12:00:00.000Z | &lt;bentech-lending-poc-v1.pine-townhomes-4@example.test&gt; |
| stone-refinance-1 | inbound | 2025-09-10T12:00:00.000Z | &lt;bentech-lending-poc-v1.stone-refinance-1@example.test&gt; |
| stone-refinance-2 | outbound | 2025-09-11T12:00:00.000Z | &lt;bentech-lending-poc-v1.stone-refinance-2@example.test&gt; |
| bay-acquisition-1 | inbound | 2025-09-10T12:00:00.000Z | &lt;bentech-lending-poc-v1.bay-acquisition-1@example.test&gt; |
| bay-acquisition-2 | outbound | 2025-09-11T12:00:00.000Z | &lt;bentech-lending-poc-v1.bay-acquisition-2@example.test&gt; |
| reed-broker-1 | inbound | 2025-09-10T12:00:00.000Z | &lt;bentech-lending-poc-v1.reed-broker-1@example.test&gt; |
| reed-broker-2 | outbound | 2025-09-11T12:00:00.000Z | &lt;bentech-lending-poc-v1.reed-broker-2@example.test&gt; |
| elm-outreach-1 | outbound | 2025-09-10T12:00:00.000Z | &lt;bentech-lending-poc-v1.elm-outreach-1@example.test&gt; |
| elm-outreach-2 | outbound | 2025-09-11T12:00:00.000Z | &lt;bentech-lending-poc-v1.elm-outreach-2@example.test&gt; |
| ash-recent-1 | inbound | 2026-08-10T12:00:00.000Z | &lt;bentech-lending-poc-v1.ash-recent-1@example.test&gt; |
| ash-recent-2 | outbound | 2026-08-11T12:00:00.000Z | &lt;bentech-lending-poc-v1.ash-recent-2@example.test&gt; |

Cedar: four-message thread; exact shared subject; References/In-Reply-To chain; synthetic CC; plain text + HTML; one text attachment. The recent final reply must survive full-thread export.

This offline dry-run validates the proposal only. Live account preflight, writer authorization, replay/cleanup verification and owner approval are separate gates. The insertion receipt must use real IDs returned by Gmail, never these proposal keys.

