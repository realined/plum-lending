import { createHash } from "node:crypto";
import { z } from "zod";
import { DEMO_AS_OF, resolveIntent, subtractMonths } from "@/domain/segment";

export const SEED_NAMESPACE = "bentech-lending-poc-v1";
export type SeedCase = {
  key: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  domain: string;
  role: "Sponsor" | "Broker";
  deal: "open" | "won" | "lost" | null;
  expected: "include" | "exclude";
  reason: string;
};
export type SeedMessage = {
  key: string;
  caseKey: string;
  threadKey?: string;
  subject: string;
  date: string;
  direction: "inbound" | "outbound";
  rfcMessageId: string;
  references: string[];
  cc: string[];
  text: string;
  attachment?: { filename: string; text: string };
};
export type SeedPlan = ReturnType<typeof createSeedPlan>;

// This is an offline proposal, not a provider insertion receipt or write authorization.
export function createSeedPlan(asOf = DEMO_AS_OF, namespace = SEED_NAMESPACE) {
  if (
    !z.iso.datetime().safeParse(asOf).success ||
    Date.parse(asOf) % 1000 !== 0 ||
    !/^[a-z][a-z0-9-]{7,39}$/.test(namespace)
  )
    throw new Error("INVALID_SEED_PLAN_INPUT");
  const frozen = new Date(asOf).toISOString();
  const spec = resolveIntent(
    {
      supported: true,
      role: "Sponsor",
      direction: "inbound",
      dealPolicy: "no_closed_won",
      lookbackMonths: 24,
      excludeRecentMonths: 3,
      clarification: null,
    },
    frozen,
  );
  const definitions = [
    [
      "cedar",
      "Mira",
      "Vale",
      "Cedar Gate Partners",
      "Sponsor",
      "open",
      "include",
      "Historical inbound activity; open deal",
    ],
    [
      "granite",
      "Owen",
      "Reed",
      "Granite Harbor Capital",
      "Sponsor",
      "won",
      "exclude",
      "Closed Won deal",
    ],
    [
      "juniper",
      "Lena",
      "Park",
      "Juniper Row Partners",
      "Sponsor",
      null,
      "exclude",
      "Activity only within the most recent three months",
    ],
    [
      "oldmill",
      "Nolan",
      "Brook",
      "Old Mill Ventures",
      "Sponsor",
      null,
      "exclude",
      "Activity older than two years",
    ],
    [
      "birch",
      "Iris",
      "Stone",
      "Silver Birch Advisors",
      "Broker",
      null,
      "exclude",
      "Not a Sponsor",
    ],
    [
      "willow",
      "Theo",
      "Marsh",
      "Willow Court Holdings",
      "Sponsor",
      "lost",
      "include",
      "Historical inbound activity; Closed Lost is allowed",
    ],
    [
      "meadow",
      "Aria",
      "Quinn",
      "North Meadow Partners",
      "Sponsor",
      null,
      "exclude",
      "No matching email communication",
    ],
  ] as const;
  const contacts: SeedCase[] = definitions.map(
    ([key, firstName, lastName, company, role, deal, expected, reason]) => ({
      key,
      firstName,
      lastName,
      role,
      deal,
      expected,
      reason,
      company: `[${namespace}] ${company}`,
      // HubSpot rejects the reserved .test TLD; this approved live corpus uses IANA example.com.
      email: `${key}.${namespace}@example.com`,
      domain: `${key}.${namespace}.example.test`,
    }),
  );
  const historical = subtractMonths(frozen, 12);
  const recent = subtractMonths(frozen, 1);
  const daysAfter = (iso: string, days: number) =>
    new Date(Date.parse(iso) + days * 86_400_000).toISOString();
  const messages: SeedMessage[] = [];
  function add(
    caseKey: string,
    date: string,
    direction: SeedMessage["direction"],
    text: string,
    attachment?: SeedMessage["attachment"],
  ) {
    const previous = messages.filter((message) => message.caseKey === caseKey);
    const key = `${caseKey}-${previous.length + 1}`;
    messages.push({
      key,
      caseKey,
      date,
      direction,
      text,
      attachment,
      subject: `[${namespace}] ${caseKey === "cedar" ? "Cedar Gate - financing inquiry" : `${caseKey} - lending review`}`,
      rfcMessageId: `<${namespace}.${key}@example.test>`,
      references: previous.map((message) => message.rfcMessageId),
      cc:
        caseKey === "cedar" && direction === "inbound"
          ? [`analyst.${namespace}@example.test`]
          : [],
    });
  }
  add(
    "cedar",
    historical,
    "inbound",
    "Hello Lending Lab,\n\nWe are exploring a fictional $4,200,000 acquisition loan for Cedar Gate, a 32-unit apartment property. The assumed purchase price is $6,000,000. Could you outline the information needed for an initial review?\n\nMira Vale",
  );
  add(
    "cedar",
    daysAfter(historical, 1),
    "outbound",
    "Hello Mira,\n\nPlease send the fictional rent roll, operating history, and proposed equity contribution. We will use them to prepare an indicative structure for this demonstration.\n\nBenTech Lending Lab",
  );
  add(
    "cedar",
    daysAfter(historical, 7),
    "inbound",
    "Hello Lending Lab,\n\nThe fictional property has 30 occupied units, annual net operating income of $420,000, and a proposed $1,800,000 equity contribution. I have included a short synthetic property summary and copied our analyst.\n\nMira Vale",
    {
      filename: "cedar-property-summary.txt",
      text: "SYNTHETIC DEMONSTRATION ONLY\nCedar Gate: 32 units; 30 occupied.\nAnnual NOI: $420,000.\nProposed loan: $4,200,000.\n",
    },
  );
  add(
    "cedar",
    recent,
    "outbound",
    "Hello Mira,\n\nThank you for the additional information. The fictional financing discussion remains open. This recent reply is outside the qualifying activity window but must remain in the complete exported thread.\n\nBenTech Lending Lab",
  );
  add(
    "granite",
    historical,
    "inbound",
    "Please review our fictional Granite Harbor financing inquiry. This contact has an associated Closed Won deal and must be excluded.",
  );
  add(
    "juniper",
    recent,
    "inbound",
    "Please review our fictional Juniper Row inquiry. This is the only activity and is inside the excluded recent period.",
  );
  add(
    "oldmill",
    subtractMonths(frozen, 30),
    "inbound",
    "This fictional Old Mill inquiry is older than the two-year lookback and must not qualify.",
  );
  add(
    "birch",
    historical,
    "inbound",
    "I represent Silver Birch Advisors as a fictional broker. My historical inquiry does not make me a Sponsor.",
  );
  add(
    "willow",
    historical,
    "inbound",
    "Please revisit the fictional Willow Court financing discussion. Our previous deal was Closed Lost, not Closed Won, so this historical Sponsor inquiry should qualify.",
  );
  return {
    version: 1 as const,
    namespace,
    asOf: frozen,
    spec,
    lenderPlaceholder: `lender.${namespace}@example.test`,
    contacts,
    messages,
    expectedContactKeys: contacts
      .filter((contact) => contact.expected === "include")
      .map((contact) => contact.key),
    counts: {
      contacts: 7,
      companies: 7,
      deals: 3,
      contactCompanyAssociations: 7,
      contactDealAssociations: 3,
      threads: 6,
      messages: 9,
      expectedRows: 2,
    },
  };
}

export function seedPlanDigest(plan: SeedPlan) {
  return createHash("sha256").update(JSON.stringify(plan)).digest("hex");
}

export function assertSeedPlan(plan: SeedPlan) {
  if (
    seedPlanDigest(plan) !==
      seedPlanDigest(createSeedPlan(plan.asOf, plan.namespace)) &&
    seedPlanDigest(plan) !==
      seedPlanDigest(createExpandedSeedPlan(plan.asOf, plan.namespace))
  )
    throw new Error("SEED_PLAN_CHANGED");
}

export function previewSeedPlan(plan: SeedPlan) {
  assertSeedPlan(plan);
  return [
    "# Fictional live dataset — offline dry-run",
    "",
    "No credentials loaded, provider requests made, or live records written.",
    `Namespace: ${plan.namespace}`,
    `Frozen reference time: ${plan.asOf}`,
    `Qualifying window: ${plan.spec.startInclusive} inclusive to ${plan.spec.endExclusive} exclusive.`,
    `Plan SHA-256: ${seedPlanDigest(plan)}`,
    "",
    "| Contact | Company | Role | Deal | Expected | Reason |",
    "| --- | --- | --- | --- | --- | --- |",
    ...plan.contacts.map(
      (c) =>
        `| ${c.firstName} ${c.lastName} | ${c.company} | ${c.role} | ${c.deal ?? "none"} | ${c.expected} | ${c.reason} |`,
    ),
    "",
    `Proposed totals: ${plan.counts.contacts} contacts, ${plan.counts.companies} companies, ${plan.counts.deals} deals, ${plan.counts.threads} threads, ${plan.counts.messages} messages; ${plan.counts.expectedRows} expected CSV rows.`,
    "",
    "| Message key | Direction | Date | RFC Message-ID |",
    "| --- | --- | --- | --- |",
    ...plan.messages.map(
      (m) =>
        `| ${m.key} | ${m.direction} | ${m.date} | ${m.rfcMessageId.replaceAll("<", "&lt;").replaceAll(">", "&gt;")} |`,
    ),
    "",
    "Cedar: four-message thread; exact shared subject; References/In-Reply-To chain; synthetic CC; plain text + HTML; one text attachment. The recent final reply must survive full-thread export.",
    "",
    "This offline dry-run validates the proposal only. Live account preflight, writer authorization, replay/cleanup verification and owner approval are separate gates. The insertion receipt must use real IDs returned by Gmail, never these proposal keys.",
    "",
  ].join("\n");
}

// Fixed additive scenario; original records are built unchanged by createSeedPlan.
export function createExpandedSeedPlan(
  asOf = DEMO_AS_OF,
  namespace = SEED_NAMESPACE,
): SeedPlan {
  const base = createSeedPlan(asOf, namespace);
  const definitions = [
    [
      "alder",
      "Elena",
      "Voss",
      "Alder Crest Partners",
      "Sponsor",
      "open",
      "include",
    ],
    [
      "harbor",
      "Marcus",
      "Finch",
      "Harbor Lantern Capital",
      "Sponsor",
      "open",
      "include",
    ],
    [
      "maple",
      "Nora",
      "Ellis",
      "Maple Terrace Ventures",
      "Sponsor",
      "lost",
      "include",
    ],
    [
      "copper",
      "Julian",
      "Hart",
      "Copper Brook Holdings",
      "Sponsor",
      null,
      "include",
    ],
    [
      "summit",
      "Camille",
      "Frost",
      "Summit Orchard Partners",
      "Sponsor",
      null,
      "include",
    ],
    [
      "river",
      "Adrian",
      "Wells",
      "River Slate Capital",
      "Sponsor",
      null,
      "include",
    ],
    [
      "oak",
      "Tessa",
      "Lane",
      "Oak Lantern Ventures",
      "Sponsor",
      null,
      "include",
    ],
    [
      "pine",
      "Simon",
      "Blake",
      "Pine Meadow Holdings",
      "Sponsor",
      null,
      "include",
    ],
    [
      "stone",
      "Vivian",
      "Holt",
      "Stone Orchard Partners",
      "Sponsor",
      "won",
      "exclude",
    ],
    ["bay", "Ethan", "Cole", "Bay Timber Capital", "Sponsor", "won", "exclude"],
    [
      "reed",
      "Clara",
      "Hayes",
      "Reed Valley Advisors",
      "Broker",
      null,
      "exclude",
    ],
    ["elm", "Lucas", "Gray", "Elm Harbor Ventures", "Sponsor", null, "exclude"],
    [
      "ash",
      "Maya",
      "Quinn",
      "Ash Terrace Partners",
      "Sponsor",
      null,
      "exclude",
    ],
  ] as const;
  for (const [
    key,
    firstName,
    lastName,
    company,
    role,
    deal,
    expected,
  ] of definitions) {
    base.contacts.push({
      key,
      firstName,
      lastName,
      company: `[${namespace}] ${company}`,
      role,
      deal,
      expected,
      email: `${key}.${namespace}@example.com`,
      domain: `${key}.${namespace}.example.test`,
      reason:
        deal === "won"
          ? "Closed Won deal"
          : role === "Broker"
            ? "Not a Sponsor"
            : key === "elm"
              ? "Outbound only"
              : key === "ash"
                ? "Recent only"
                : "Historical inbound activity; no Closed Won deal",
    });
  }
  const stories = [
    [
      "alder",
      "acquisition",
      "Alder Crest apartments acquisition",
      18,
      "a fictional 48-unit apartment acquisition at a $7.2m purchase price",
      "the rent roll and operating history",
      "occupancy of 44 units and a phased renovation plan",
    ],
    [
      "alder",
      "renovation",
      "Alder Crest renovation reserve discussion",
      6,
      "a fictional $650k renovation reserve",
      "the construction scope and schedule",
      "six unit turns per quarter with a 10% contingency",
    ],
    [
      "harbor",
      "refinance",
      "Harbor Lantern industrial refinance",
      12,
      "refinancing a fictional small industrial campus",
      "the maturity date and lease summary",
      "a November maturity and three tenants with staggered lease expirations",
    ],
    [
      "harbor",
      "expansion",
      "Harbor Lantern warehouse expansion",
      6,
      "a fictional warehouse expansion beside the campus",
      "land control and permit status",
      "an option agreement and a preliminary permit review schedule",
    ],
    [
      "maple",
      "retail",
      "Maple Terrace retail acquisition review",
      18,
      "a fictional neighborhood retail acquisition",
      "tenant concentrations and lease terms",
      "eight tenants with no single tenant above 20% of rent",
    ],
    [
      "copper",
      "bridge",
      "Copper Brook bridge financing inquiry",
      12,
      "a fictional office-to-flex repositioning bridge loan",
      "milestones and the exit plan",
      "a twelve-month improvement schedule followed by a refinance review",
    ],
    [
      "summit",
      "multifamily",
      "Summit Orchard multifamily financing",
      6,
      "a fictional 32-unit apartment acquisition",
      "property operations and the equity contribution",
      "a synthetic operating summary and a 30% equity contribution",
    ],
    [
      "river",
      "storage",
      "River Slate self-storage refinance",
      18,
      "refinancing a fictional self-storage property",
      "occupancy and trailing operations",
      "a synthetic 88% occupancy assumption and planned access-control upgrades",
    ],
    [
      "oak",
      "medical",
      "Oak Lantern medical office acquisition",
      12,
      "a fictional medical office acquisition",
      "lease expirations and tenant mix",
      "four hypothetical medical tenants with staggered five-year leases",
    ],
    [
      "pine",
      "townhomes",
      "Pine Meadow townhome construction inquiry",
      6,
      "a fictional 18-home rental development",
      "approvals, budget and completion timing",
      "a synthetic cost summary and an eighteen-month construction schedule",
    ],
    [
      "stone",
      "refinance",
      "Stone Orchard completed refinance",
      12,
      "a fictional multifamily refinance",
      "remaining diligence documents",
      "",
    ],
    [
      "bay",
      "acquisition",
      "Bay Timber warehouse acquisition request",
      12,
      "a fictional warehouse purchase",
      "remaining diligence documents",
      "",
    ],
    [
      "reed",
      "broker",
      "Reed Valley financing introduction",
      12,
      "a fictional financing introduction in my capacity as a broker",
      "the referral details",
      "",
    ],
    [
      "elm",
      "outreach",
      "Elm Harbor lender outreach",
      12,
      "a fictional financing review",
      "",
      "",
    ],
    [
      "ash",
      "recent",
      "Ash Terrace new financing inquiry",
      1,
      "a fictional property financing inquiry",
      "the proposed transaction details",
      "",
    ],
  ] as const;
  const daysAfter = (date: string, days: number) =>
    new Date(Date.parse(date) + days * 86400000).toISOString();
  for (const [
    caseKey,
    topic,
    title,
    months,
    request,
    question,
    details,
  ] of stories) {
    const contact = base.contacts.find((c) => c.key === caseKey)!;
    const threadKey = `${caseKey}-${topic}`;
    const start = daysAfter(subtractMonths(base.asOf, months), -6);
    const bodies =
      caseKey === "elm"
        ? [
            `Hello ${contact.firstName},\n\nWould a review of ${request} be useful? Please let us know whether you have an active project and its expected timing. This is a synthetic demonstration conversation.\n\nBenTech Lending Lab`,
            `Hello ${contact.firstName},\n\nFollowing up on the financing review. We have not received a reply. This synthetic outbound-only conversation must not establish inbound activity.\n\nBenTech Lending Lab`,
          ]
        : [
            `Hello Lending Lab,\n\nI would like to discuss financing for ${request}. Could you outline the information needed for an initial review? All property details in this conversation are invented for the lending application demonstration. No real borrower or property is represented.\n\n${contact.firstName} ${contact.lastName}`,
            `Hello ${contact.firstName},\n\nThank you for the inquiry. Please provide ${question} so we can review the proposed structure and timeline. This request is illustrative and does not represent a lending commitment. We can revisit the assumptions after the supporting information arrives.\n\nBenTech Lending Lab`,
            ...(contact.expected === "include"
              ? [
                  `Hello Lending Lab,\n\nFor the fictional review, please assume ${details}. These figures are synthetic and are intended to demonstrate retaining conversation context. Please let me know what additional details would help the next review.\n\n${contact.firstName} ${contact.lastName}`,
                  `Hello ${contact.firstName},\n\nChecking in on ${request}. Has the timing or project plan changed? Please share an updated summary when available. This recent follow-up remains part of the complete conversation even though it is outside the historical qualifying window.\n\nBenTech Lending Lab`,
                ]
              : []),
          ];
    bodies.forEach((text, i) => {
      const key = `${threadKey}-${i + 1}`;
      const previous = base.messages.filter((m) => m.threadKey === threadKey);
      base.messages.push({
        key,
        caseKey,
        threadKey,
        subject: `[${namespace}] ${title}`,
        date: i === 3 ? subtractMonths(base.asOf, 1) : daysAfter(start, i),
        direction: caseKey === "elm" || i % 2 === 1 ? "outbound" : "inbound",
        text,
        rfcMessageId: `<${namespace}.${key}@example.test>`,
        references: previous.map((m) => m.rfcMessageId),
        cc:
          caseKey === "alder" && i === 2
            ? [`analyst.${namespace}@example.test`]
            : [],
        ...(caseKey === "alder" && topic === "acquisition" && i === 2
          ? {
              attachment: {
                filename: "alder-synthetic-summary.txt",
                text: "SYNTHETIC DEMONSTRATION ONLY\n48 units; 44 occupied; phased renovations.\n",
              },
            }
          : {}),
      });
    });
  }
  base.expectedContactKeys = base.contacts
    .filter((c) => c.expected === "include")
    .map((c) => c.key);
  base.counts = {
    contacts: 20,
    companies: 20,
    deals: 8,
    contactCompanyAssociations: 20,
    contactDealAssociations: 8,
    threads: 21,
    messages: 59,
    expectedRows: 12,
  };
  return base;
}

export const seedThreadKey = (message: SeedMessage) =>
  message.threadKey ?? message.caseKey;
