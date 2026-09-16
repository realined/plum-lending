import type { CRMProvider, EmailProvider } from "./contracts";
import type { CRMSnapshot, Thread, Message, Contact } from "@/domain/models";
import { DEMO_AS_OF } from "@/domain/segment";
export type DemoScenario = "standard" | "partial" | "empty" | "outage";
export const DEMO_LENDER = "lending@plum.example.test";
const names = [
  ["Avery", "Morgan", "Juniper Capital"],
  ["Jordan", "Ellis", "Northline Partners"],
  ["Casey", "Reed", "Cedar House Group"],
  ["Riley", "Chen", "Harborstone Ventures"],
  ["Quinn", "Brooks", "Willow Ridge"],
  ["Drew", "Parker", "Atlas Residential"],
  ["Taylor", "Lane", "Summit Commercial"],
  ["Alex", "Hayes", "Bridgepoint Partners"],
];
export const demoContacts: Contact[] = names.map(
  ([firstName, lastName], i) => ({
    id: `c${i + 1}`,
    firstName,
    lastName,
    emails: [`${firstName.toLowerCase()}@sponsor${i + 1}.example.test`],
    role: i === 4 ? "Broker" : "Sponsor",
    companyIds: [`a${i + 1}`],
    dealIds: i === 3 ? ["won-1"] : i === 1 ? ["lost-1"] : [],
    associationsComplete: true,
  }),
);
const msg = (
  id: string,
  tid: string,
  contact: number,
  date: string,
  text: string,
  outbound = false,
): Message => ({
  providerMessageId: id,
  providerThreadId: tid,
  subject: subjects[tid] ?? "Financing discussion",
  from: {
    email: outbound ? DEMO_LENDER : demoContacts[contact].emails[0],
    name: outbound ? "Plum lending team" : demoContacts[contact].firstName,
  },
  to: [
    {
      email: outbound ? demoContacts[contact].emails[0] : DEMO_LENDER,
      name: "",
    },
  ],
  cc: [],
  bcc: [],
  timestamp: date,
  text,
  sanitizedHtml: null,
  direction: outbound ? "outbound" : "inbound",
  attachments:
    id === "m2"
      ? [
          {
            providerAttachmentId: "att-1",
            filename: "Juniper-property-overview.pdf",
            mimeType: "application/pdf",
            size: 182400,
          },
        ]
      : [],
  position: 0,
});
const subjects: Record<string, string> = {
  t1: "Juniper Park · acquisition financing",
  t2: "Northline · multifamily refinance",
  t3: "Cedar House · bridge loan request",
  t4: "Harborstone · closed acquisition",
  t5: "Willow Ridge · broker introduction",
  t6: "Atlas · recent inquiry",
  t7: "Summit · lender follow-up",
  t8: "Bridgepoint · archived opportunity",
  t9: "Juniper · second-phase development",
};
function thread(id: string, messages: Message[]): Thread {
  return {
    provider: "demo",
    providerThreadId: id,
    subject: subjects[id],
    messages: messages
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .map((m, position) => ({ ...m, position })),
  };
}
export const demoThreads: Thread[] = [
  thread("t1", [
    msg(
      "m1",
      "t1",
      0,
      "2024-08-20T10:00:00.000Z",
      "We are evaluating a 72-unit acquisition at Juniper Park. Could your team outline financing options?",
    ),
    msg(
      "m2",
      "t1",
      0,
      "2025-02-12T14:20:00.000Z",
      "Attached is our updated property overview. We are seeking a $12 million acquisition facility with a 24-month term.",
    ),
    msg(
      "m3",
      "t1",
      0,
      "2025-02-13T09:10:00.000Z",
      "Thanks, Avery. Please share the current rent roll and renovation budget so we can assess the structure.",
      true,
    ),
    msg(
      "m4",
      "t1",
      0,
      "2026-08-03T16:45:00.000Z",
      "Our timing has moved to Q4. Keeping this thread open for the updated package.",
    ),
  ]),
  thread("t2", [
    msg(
      "m5",
      "t2",
      1,
      "2025-05-19T11:30:00.000Z",
      "We would like to revisit refinancing our Northline multifamily portfolio. The previous transaction did not proceed.",
    ),
    msg(
      "m6",
      "t2",
      1,
      "2025-05-20T15:00:00.000Z",
      "Happy to reconnect. Please send the portfolio operating statements and your target proceeds.",
      true,
    ),
  ]),
  thread("t3", [
    msg(
      "m7",
      "t3",
      2,
      "2024-09-16T12:00:00.000Z",
      "We are looking for a bridge facility for Cedar House. Can we discuss a $6 million request?",
    ),
    msg(
      "m8",
      "t3",
      2,
      "2024-09-17T08:30:00.000Z",
      "We can review the opportunity. What is your stabilization timeline?",
      true,
    ),
    msg(
      "m9",
      "t3",
      2,
      "2025-01-08T13:40:00.000Z",
      "Our stabilization plan is 18 months. The capital expenditure schedule is ready for review.",
    ),
  ]),
  thread("t4", [
    msg(
      "m10",
      "t4",
      3,
      "2025-04-01T10:00:00.000Z",
      "Following up on the acquisition we closed together.",
    ),
  ]),
  thread("t5", [
    msg(
      "m11",
      "t5",
      4,
      "2025-03-01T10:00:00.000Z",
      "I am a broker introducing a financing opportunity.",
    ),
  ]),
  thread("t6", [
    msg(
      "m12",
      "t6",
      5,
      "2026-06-16T12:00:00.000Z",
      "This first inquiry falls exactly on the excluded recent-window boundary.",
    ),
  ]),
  thread("t7", [
    msg(
      "m13",
      "t7",
      6,
      "2025-04-01T10:00:00.000Z",
      "Checking whether your team has any financing needs.",
      true,
    ),
  ]),
  thread("t8", [
    msg(
      "m14",
      "t8",
      7,
      "2024-09-16T11:59:59.000Z",
      "This archived opportunity predates the requested window.",
    ),
  ]),
  thread("t9", [
    msg(
      "m15",
      "t9",
      0,
      "2025-11-04T10:30:00.000Z",
      "A separate opportunity: we are planning phase two of our Juniper development. Would a construction-to-permanent structure fit?",
    ),
    msg(
      "m16",
      "t9",
      0,
      "2025-11-05T14:15:00.000Z",
      "Please share the project schedule and sponsor equity commitment; we will review the options.",
      true,
    ),
  ]),
];
export class DemoCRM implements CRMProvider {
  readonly name = "demo" as const;
  async validateConnection() {}
  async searchContacts() {
    return structuredClone(demoContacts);
  }
  async getCompanies() {
    return names.map((n, i) => ({ id: `a${i + 1}`, name: n[2] }));
  }
  async getDeals() {
    return [
      {
        id: "won-1",
        name: "Harborstone acquisition",
        stage: "closedwon",
        pipeline: "default",
        status: "won" as const,
      },
      {
        id: "lost-1",
        name: "Northline prior transaction",
        stage: "closedlost",
        pipeline: "default",
        status: "lost" as const,
      },
    ];
  }
  async getAssociations(id: string) {
    const c = demoContacts.find((c) => c.id === id);
    return { companyIds: c?.companyIds ?? [], dealIds: c?.dealIds ?? [] };
  }
  async snapshot(): Promise<CRMSnapshot> {
    return {
      contacts: await this.searchContacts(),
      companies: await this.getCompanies(),
      deals: await this.getDeals(),
      failures: [],
      capturedAt: DEMO_AS_OF,
    };
  }
}
export class DemoEmail implements EmailProvider {
  readonly name = "demo" as const;
  constructor(private scenario: DemoScenario = "standard") {}
  async validateConnection() {
    return { mailbox: DEMO_LENDER, cursor: "demo-v1" };
  }
  async *searchThreads() {
    if (this.scenario === "outage") throw new Error("DEMO_OUTAGE");
    if (this.scenario === "empty") return;
    for (const t of demoThreads) yield t.providerThreadId;
    yield "t1";
  }
  async getThread(id: string) {
    if (this.scenario === "partial" && id === "t3")
      throw new Error("DEMO_THREAD_FAILURE");
    const t = demoThreads.find((t) => t.providerThreadId === id);
    if (!t) throw new Error("NOT_FOUND");
    return structuredClone(t);
  }
  async synchronize() {
    return {
      threadIds: demoThreads.map((t) => t.providerThreadId),
      deletedMessageIds: [],
      nextCursor: "demo-v1",
      requiresFullSync: false,
    };
  }
}
