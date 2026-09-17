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
    seedPlanDigest(createSeedPlan(plan.asOf, plan.namespace))
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
