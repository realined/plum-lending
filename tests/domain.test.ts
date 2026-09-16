import { describe, expect, it, vi } from "vitest";
import { csvCell, CSV_HEADERS, toCsv } from "@/domain/csv";
import { executeSegment } from "@/domain/executor";
import { normalizeEmail, uniqueEmails } from "@/domain/identity";
import type {
  Contact,
  CRMSnapshot,
  Deal,
  Message,
  Thread,
} from "@/domain/models";
import {
  DEFAULT_QUERY,
  intentSchema,
  parseDemo,
  resolveIntent,
  segmentSchema,
  subtractMonths,
} from "@/domain/segment";
import type { EmailProvider } from "@/providers/contracts";

const asOf = "2026-09-16T12:00:00.000Z";
const spec = parseDemo(DEFAULT_QUERY, asOf);
const lender = "lender@example.test";
const intent = {
  supported: true,
  role: "Sponsor",
  lookbackMonths: 24,
  excludeRecentMonths: 3,
  direction: "inbound",
  dealPolicy: "no_closed_won",
  clarification: null,
};

function contact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: "contact-1",
    firstName: "Synthetic",
    lastName: "Sponsor",
    emails: ["sponsor@example.test"],
    role: "Sponsor",
    companyIds: ["company-1"],
    dealIds: [],
    associationsComplete: true,
    ...overrides,
  };
}
function message(overrides: Partial<Message> = {}): Message {
  return {
    providerMessageId: "message-1",
    providerThreadId: "thread-1",
    subject: "Synthetic conversation",
    from: { email: "sponsor@example.test", name: "Synthetic Sponsor" },
    to: [{ email: lender, name: "Synthetic Lender" }],
    cc: [],
    bcc: [],
    timestamp: "2025-03-01T12:00:00.000Z",
    text: "Synthetic correspondence only.",
    sanitizedHtml: null,
    direction: "inbound",
    attachments: [],
    position: 0,
    ...overrides,
  };
}
function thread(messages: Message[] = [message()], id = "thread-1"): Thread {
  return {
    provider: "demo",
    providerThreadId: id,
    subject: "Synthetic conversation",
    messages: messages.map((m) => ({ ...m, providerThreadId: id })),
  };
}
function snapshot(
  contacts: Contact[] = [contact()],
  deals: Deal[] = [],
): CRMSnapshot {
  return {
    contacts,
    companies: [
      { id: "company-1", name: "Synthetic Holdings" },
      { id: "company-2", name: "Second Synthetic Company" },
    ],
    deals,
    failures: [],
    capturedAt: asOf,
  };
}
function provider(
  threads: Thread[] = [thread()],
  searchIds = threads.map((t) => t.providerThreadId),
): EmailProvider & { getThread: ReturnType<typeof vi.fn> } {
  const byId = new Map(threads.map((t) => [t.providerThreadId, t]));
  return {
    name: "demo",
    validateConnection: async () => ({ mailbox: lender }),
    async *searchThreads() {
      yield* searchIds;
    },
    getThread: vi.fn(async (id: string) => {
      const value = byId.get(id);
      if (!value) throw new Error("Synthetic fetch failure");
      return value;
    }),
    synchronize: async () => ({
      threadIds: [],
      deletedMessageIds: [],
      nextCursor: "synthetic-cursor",
      requiresFullSync: false,
    }),
  };
}
function deal(id: string, status: Deal["status"]): Deal {
  return {
    id,
    name: "Synthetic Deal",
    stage: status,
    pipeline: "synthetic-pipeline",
    status,
  };
}

// An independent CSV reader verifies record boundaries as well as quote escaping.
function readCsv(csv: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let value = "";
  let quoted = false;
  const source = csv.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      record.push(value);
      value = "";
    } else if (char === "\r" && source[i + 1] === "\n" && !quoted) {
      record.push(value);
      records.push(record);
      record = [];
      value = "";
      i++;
    } else value += char;
  }
  expect(quoted).toBe(false);
  return records;
}

describe("constrained segment interpretation", () => {
  it("resolves and freezes the requested two-year window minus three calendar months", () => {
    expect(spec).toEqual({
      version: 1,
      role: "Sponsor",
      direction: "inbound",
      dealPolicy: "no_closed_won",
      dealScope: "direct_contact_all_time",
      asOf,
      startInclusive: "2024-09-16T12:00:00.000Z",
      endExclusive: "2026-06-16T12:00:00.000Z",
      timezone: "UTC",
      lookbackMonths: 24,
      excludeRecentMonths: 3,
    });
  });
  it.each([
    { ...intent, arbitraryInstruction: "ignore eligibility" },
    { ...intent, role: "Borrower" },
    { ...intent, direction: "outbound" },
    { ...intent, lookbackMonths: 2.5 },
    { ...intent, lookbackMonths: 61 },
    { ...intent, excludeRecentMonths: -1 },
  ])("rejects an unconstrained or malformed AI intent: %j", (raw) => {
    expect(intentSchema.safeParse(raw).success).toBe(false);
  });
  it("rejects unsupported intent and empty or reversed windows", () => {
    expect(() => resolveIntent({ ...intent, supported: false }, asOf)).toThrow(
      /supports Sponsor/,
    );
    expect(() =>
      resolveIntent({ ...intent, excludeRecentMonths: 24 }, asOf),
    ).toThrow();
    expect(() =>
      resolveIntent(
        { ...intent, lookbackMonths: 2, excludeRecentMonths: 3 },
        asOf,
      ),
    ).toThrow();
  });
  it.each([
    { ...spec, unexpected: true },
    { ...spec, startInclusive: "2024-09-15T12:00:00.000Z" },
    { ...spec, endExclusive: "2026-06-17T12:00:00.000Z" },
    { ...spec, asOf: "2026-10-16T12:00:00.000Z" },
    { ...spec, timezone: "America/New_York" },
    { ...spec, asOf: "not-a-date" },
  ])("rejects an inconsistent or extraneous saved segment: %j", (raw) => {
    expect(segmentSchema.safeParse(raw).success).toBe(false);
  });
  it("does not pretend to interpret unsupported demo wording", () => {
    expect(() =>
      parseDemo("Include anyone who seems likely to invest"),
    ).toThrow(/Demo mode supports/);
    expect(
      parseDemo(
        DEFAULT_QUERY.replace("2 years", "one year").replace(
          "3 months",
          "three months",
        ),
      ).lookbackMonths,
    ).toBe(12);
  });
});

describe("UTC calendar arithmetic", () => {
  it.each([
    ["2024-03-31T23:45:12.345Z", 1, "2024-02-29T23:45:12.345Z"],
    ["2025-03-31T23:45:12.345Z", 1, "2025-02-28T23:45:12.345Z"],
    ["2024-02-29T00:00:00.000Z", 12, "2023-02-28T00:00:00.000Z"],
    ["2026-01-31T00:00:00.000Z", 3, "2025-10-31T00:00:00.000Z"],
    ["2026-05-31T04:30:00.000Z", 1, "2026-04-30T04:30:00.000Z"],
    ["2026-09-16T12:00:00.000Z", 0, "2026-09-16T12:00:00.000Z"],
  ])(
    "subtracts %s by %i months without overflow or local-time drift",
    (date, months, expected) => {
      expect(subtractMonths(date, months)).toBe(expected);
    },
  );
});

describe("email identities", () => {
  it("normalizes case and surrounding whitespace, retaining meaningful address characters", () => {
    expect(normalizeEmail("  Sponsor+Investor@Example.Test  ")).toBe(
      "sponsor+investor@example.test",
    );
    expect(
      uniqueEmails(["Z@example.test", " A@example.test ", "a@EXAMPLE.TEST"]),
    ).toEqual(["a@example.test", "z@example.test"]);
    expect(normalizeEmail("sponsor.alias@example.test")).not.toBe(
      normalizeEmail("sponsoralias@example.test"),
    );
    expect(normalizeEmail("sponsor+tag@example.test")).not.toBe(
      normalizeEmail("sponsor@example.test"),
    );
    expect(() => normalizeEmail("not an email")).toThrow();
  });
});

describe("deterministic contact and deal eligibility", () => {
  it("matches a secondary contact email and resolves only that contact's associated companies", async () => {
    const crm = snapshot([
      contact({
        emails: ["primary@example.test", "SPONSOR@EXAMPLE.TEST"],
        companyIds: ["company-2", "company-1"],
      }),
    ]);
    const result = await executeSegment(spec, crm, provider(), [
      " LENDER@EXAMPLE.TEST ",
    ]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      contactId: "contact-1",
      email: "primary@example.test",
      accountName: "Second Synthetic Company; Synthetic Holdings",
    });
  });
  it("does not infer identity from a name, company, thread participant, or similar address", async () => {
    const crm = snapshot([
      contact(),
      contact({ id: "same-company", emails: ["other@example.test"] }),
      contact({
        id: "not-sponsor",
        emails: ["sponsor@example.test"],
        role: "Lender",
      }),
    ]);
    const result = await executeSegment(
      spec,
      crm,
      provider([
        thread([
          message({
            cc: [{ name: "Synthetic Sponsor", email: "other@example.test" }],
          }),
        ]),
      ]),
      [lender],
    );
    expect(result.rows.map((r) => r.contactId)).toEqual(["contact-1"]);
    expect(result.exclusions).toEqual({
      "Not a Sponsor": 1,
      "No qualifying inbound email": 1,
    });
    const plusAddress = await executeSegment(
      spec,
      snapshot(),
      provider([
        thread([
          message({
            from: {
              email: "sponsor+tag@example.test",
              name: "Synthetic Sponsor",
            },
          }),
        ]),
      ]),
      [lender],
    );
    expect(plusAddress.rows).toEqual([]);
  });
  it.each(["to", "cc", "bcc"] as const)(
    "accepts the lender in %s",
    async (field) => {
      const msg = message({
        to: [],
        cc: [],
        bcc: [],
        [field]: [{ email: lender.toUpperCase(), name: "" }],
      });
      expect(
        (
          await executeSegment(spec, snapshot(), provider([thread([msg])]), [
            lender,
          ])
        ).rows,
      ).toHaveLength(1);
    },
  );
  it.each([
    message({ direction: "outbound" }),
    message({ direction: "other" }),
    message({ to: [{ email: "unrelated@example.test", name: "" }] }),
    message({
      from: { email: lender, name: "Synthetic Sponsor" },
      to: [{ email: "sponsor@example.test", name: "" }],
    }),
  ])(
    "requires the contact as inbound sender and lender as recipient: %j",
    async (msg) => {
      expect(
        (
          await executeSegment(spec, snapshot(), provider([thread([msg])]), [
            lender,
          ])
        ).rows,
      ).toEqual([]);
    },
  );
  it("allows open/lost deals and ignores another contact's Closed Won deal even within the same company", async () => {
    const crm = snapshot(
      [
        contact({ dealIds: ["open", "lost"] }),
        contact({
          id: "won-contact",
          emails: ["other@example.test"],
          dealIds: ["won"],
        }),
      ],
      [deal("open", "open"), deal("lost", "lost"), deal("won", "won")],
    );
    const result = await executeSegment(spec, crm, provider(), [lender]);
    expect(result.rows.map((r) => r.contactId)).toEqual(["contact-1"]);
    expect(result.exclusions["Closed Won deal"]).toBe(1);
  });
  it("excludes a direct Closed Won deal regardless of pipeline or email age", async () => {
    const crm = snapshot(
      [contact({ dealIds: ["won"] })],
      [{ ...deal("won", "won"), pipeline: "archived-pipeline" }],
    );
    const result = await executeSegment(spec, crm, provider(), [lender]);
    expect(result.rows).toEqual([]);
    expect(result.exclusions).toEqual({ "Closed Won deal": 1 });
    expect(result.failures).toEqual([]);
  });
  it.each([
    contact({ associationsComplete: false }),
    contact({ dealIds: ["missing"] }),
    contact({ dealIds: ["unknown"] }),
  ])(
    "fails closed when CRM eligibility is incomplete: %j",
    async (candidate) => {
      const result = await executeSegment(
        spec,
        snapshot([candidate], [deal("unknown", "unknown")]),
        provider(),
        [lender],
      );
      expect(result.rows).toEqual([]);
      expect(result.exclusions).toEqual({
        "CRM eligibility could not be verified": 1,
      });
      expect(result.failures).toEqual([
        { scope: "contact", code: "CRM_INCOMPLETE", reference: "contact-1" },
      ]);
      expect(result.counts.failures).toBe(1);
    },
  );
  it("preserves existing CRM failures without duplicating a contact failure", async () => {
    const crm = snapshot([contact({ associationsComplete: false })]);
    crm.failures = [
      {
        scope: "contact",
        code: "ASSOCIATION_FETCH_FAILED",
        reference: "contact-1",
      },
    ];
    const result = await executeSegment(spec, crm, provider(), [lender]);
    expect(result.failures).toEqual(crm.failures);
  });
});

describe("thread execution and completeness", () => {
  it("includes the exact start instant and excludes the exact end instant", async () => {
    const threads = [
      thread(
        [message({ timestamp: "2024-09-16T11:59:59.999Z" })],
        "before-start",
      ),
      thread([message({ timestamp: spec.startInclusive })], "at-start"),
      thread(
        [message({ timestamp: "2026-06-16T11:59:59.999Z" })],
        "before-end",
      ),
      thread([message({ timestamp: spec.endExclusive })], "at-end"),
    ];
    expect(
      (
        await executeSegment(spec, snapshot(), provider(threads), [lender])
      ).rows.map((r) => r.threadId),
    ).toEqual(["at-start", "before-end"]);
  });
  it("compares ISO instants correctly when a valid provider timestamp omits fractional seconds", async () => {
    const threads = [
      thread(
        [message({ timestamp: "2024-09-16T12:00:00Z" })],
        "start-no-fraction",
      ),
      thread(
        [message({ timestamp: "2026-06-16T12:00:00Z" })],
        "end-no-fraction",
      ),
      thread(
        [message({ timestamp: "2025-03-01T12:00:00Z" })],
        "middle-no-fraction",
      ),
    ];
    expect(
      (
        await executeSegment(spec, snapshot(), provider(threads), [lender])
      ).rows.map((r) => r.threadId),
    ).toEqual(["middle-no-fraction", "start-no-fraction"]);
  });
  it("uses actual instants at subsecond boundaries rather than ISO string ordering", async () => {
    const subsecondSpec = parseDemo(DEFAULT_QUERY, "2026-09-16T12:00:00.500Z");
    const threads = [
      thread(
        [message({ timestamp: "2024-09-16T12:00:00Z" })],
        "before-subsecond-start",
      ),
      thread(
        [message({ timestamp: "2026-06-16T12:00:00Z" })],
        "before-subsecond-end",
      ),
    ];
    expect(
      (
        await executeSegment(subsecondSpec, snapshot(), provider(threads), [
          lender,
        ])
      ).rows.map((r) => r.threadId),
    ).toEqual(["before-subsecond-end"]);
  });
  it("orders variable-precision timestamps by their actual instants", async () => {
    const messages = [
      message({
        providerMessageId: "earlier",
        timestamp: "2025-03-01T12:00:00Z",
      }),
      message({
        providerMessageId: "later",
        timestamp: "2025-03-01T12:00:00.500Z",
      }),
    ];
    const result = await executeSegment(
      spec,
      snapshot(),
      provider([thread(messages)]),
      [lender],
    );
    expect(result.rows[0].raw.messages.map((m) => m.providerMessageId)).toEqual(
      ["earlier", "later"],
    );
    expect(result.rows[0].lastActivity).toBe("2025-03-01T12:00:00.500Z");
  });
  it("exports the whole accessible thread in chronological order with stable tie breaks", async () => {
    const messages = [
      message({
        providerMessageId: "z-latest",
        timestamp: "2026-09-01T00:00:00.000Z",
        direction: "outbound",
        from: { email: lender, name: "Lender" },
        text: "Later reply outside the window",
        position: 8,
      }),
      message({
        providerMessageId: "c-match",
        text: "Qualifying inbound",
        position: 4,
      }),
      message({
        providerMessageId: "a-old",
        timestamp: "2023-01-01T00:00:00.000Z",
        text: "Earlier context outside the window",
        position: 3,
      }),
      message({
        providerMessageId: "b-same-time",
        direction: "outbound",
        from: { email: lender, name: "Lender" },
        text: "Same-time reply",
        position: 9,
      }),
    ];
    const result = await executeSegment(
      spec,
      snapshot(),
      provider([thread(messages)]),
      [lender],
    );
    const row = result.rows[0];
    expect(row.raw.messages.map((m) => m.providerMessageId)).toEqual([
      "a-old",
      "b-same-time",
      "c-match",
      "z-latest",
    ]);
    expect(row.raw.messages.map((m) => m.position)).toEqual([0, 1, 2, 3]);
    expect(row.qualifyingMessageIds).toEqual(["c-match"]);
    expect(row.lastActivity).toBe("2026-09-01T00:00:00.000Z");
    expect(row.body).toContain("Earlier context outside the window");
    expect(row.body).toContain("Later reply outside the window");
    expect(result.counts).toEqual({
      contacts: 1,
      threads: 1,
      messages: 4,
      excluded: 0,
      failures: 0,
      scannedContacts: 1,
    });
    expect(messages.map((m) => m.position)).toEqual([8, 4, 3, 9]);
  });
  it("deduplicates repeated stable contact and search thread IDs", async () => {
    const email = provider([thread()], ["thread-1", "thread-1", "thread-1"]);
    const progress = vi.fn(async () => {});
    const result = await executeSegment(
      spec,
      snapshot([contact(), contact()]),
      email,
      [lender],
      progress,
    );
    expect(result.rows).toHaveLength(1);
    expect(email.getThread).toHaveBeenCalledTimes(1);
    expect(progress).toHaveBeenCalledExactlyOnceWith(1, 1);
    expect(result.counts).toEqual({
      contacts: 1,
      threads: 1,
      messages: 1,
      excluded: 0,
      failures: 0,
      scannedContacts: 1,
    });
  });
  it("includes each stable message ID only once in a thread and its qualifying evidence", async () => {
    const result = await executeSegment(
      spec,
      snapshot(),
      provider([thread([message(), message()])]),
      [lender],
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].raw.messages).toHaveLength(1);
    expect(result.rows[0].qualifyingMessageIds).toEqual(["message-1"]);
    expect(result.counts.messages).toBe(1);
  });
  it("emits one row per contact/thread pair while counting shared threads and messages once", async () => {
    const crm = snapshot([
      contact(),
      contact({
        id: "contact-2",
        firstName: "Another",
        emails: ["second@example.test"],
      }),
    ]);
    const messages = [
      message(),
      message({
        providerMessageId: "message-2",
        from: { email: "second@example.test", name: "Another Sponsor" },
      }),
    ];
    const result = await executeSegment(
      spec,
      crm,
      provider([thread(messages)]),
      [lender],
    );
    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((r) => r.qualifyingMessageIds)).toEqual([
      ["message-2"],
      ["message-1"],
    ]);
    expect(result.counts).toMatchObject({
      contacts: 2,
      threads: 1,
      messages: 2,
    });
  });
  it("keeps successful threads and reports each inaccessible or ID-mismatched thread", async () => {
    const email = provider([thread()], ["thread-1", "missing", "mismatched"]);
    email.getThread.mockImplementation(async (id: string) => {
      if (id === "missing") throw new Error("Unavailable");
      return thread();
    });
    const progress = vi.fn(async () => {});
    const result = await executeSegment(
      spec,
      snapshot(),
      email,
      [lender],
      progress,
    );
    expect(result.rows).toHaveLength(1);
    expect(result.failures).toEqual([
      { scope: "thread", code: "THREAD_UNAVAILABLE", reference: "missing" },
      { scope: "thread", code: "THREAD_UNAVAILABLE", reference: "mismatched" },
    ]);
    expect(result.counts).toMatchObject({
      contacts: 1,
      threads: 1,
      messages: 1,
      failures: 2,
    });
    expect(progress.mock.calls).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });
  it("reports invalid thread payloads as partial failures", async () => {
    const email = provider();
    email.getThread.mockResolvedValue({ ...thread(), messages: [] });
    const result = await executeSegment(spec, snapshot(), email, [lender]);
    expect(result.rows).toEqual([]);
    expect(result.failures).toEqual([
      { scope: "thread", code: "THREAD_UNAVAILABLE", reference: "thread-1" },
    ]);
  });
  it("rejects a failed thread search instead of reporting a complete empty result", async () => {
    const email = provider();
    email.searchThreads = async function* () {
      yield "thread-1";
      throw new Error("Synthetic pagination failure");
    };
    await expect(
      executeSegment(spec, snapshot(), email, [lender]),
    ).rejects.toThrow("Synthetic pagination failure");
  });
});

describe("safe, complete CSV export", () => {
  it.each([
    "=SUM(1,2)",
    "+1",
    "-1",
    "@command",
    "  =1",
    "\t=1",
    "\rplain",
    "\nplain",
    "\u0000=1",
  ])("neutralizes spreadsheet formula/control prefix %j", (input) => {
    expect(csvCell(input)).toBe(`"'${input}"`);
  });
  it("quotes commas, embedded quotes and line breaks without changing ordinary text", () => {
    expect(csvCell('A, "quoted"\nline')).toBe('"A, ""quoted""\nline"');
    expect(csvCell("Ordinary - prose")).toBe('"Ordinary - prose"');
    expect(csvCell("")).toBe('""');
  });
  it("exports the specified eight columns, multiline body, and lossless raw JSON", async () => {
    const original = thread([
      message({
        text: 'First line, with "quotes"\nSecond line\r\nThird line',
        attachments: [
          {
            providerAttachmentId: "attachment-1",
            filename: 'synthetic, "memo".pdf',
            mimeType: "application/pdf",
            size: 12,
          },
        ],
      }),
    ]);
    original.subject = '=HYPERLINK("https://example.test")';
    const result = await executeSegment(
      spec,
      snapshot(),
      provider([original]),
      [lender],
    );
    const csv = toCsv(result.rows);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv.endsWith("\r\n")).toBe(true);
    const records = readCsv(csv);
    expect(records).toHaveLength(2);
    expect(records[0]).toEqual([...CSV_HEADERS]);
    expect(records[1]).toHaveLength(8);
    expect(records[1][0]).toBe(`'${original.subject}`);
    expect(records[1][1]).toBe(result.rows[0].body);
    expect(records[1].slice(2, 7)).toEqual([
      "Synthetic Holdings",
      "Synthetic",
      "Sponsor",
      "sponsor@example.test",
      "2025-03-01T12:00:00.000Z",
    ]);
    expect(JSON.parse(records[1][7])).toEqual(result.rows[0].raw);
  });
  it("provides the header when there are no matches", () => {
    expect(readCsv(toCsv([]))).toEqual([[...CSV_HEADERS]]);
  });
});

// Retrieval candidates are limited by CRM, while the domain remains authoritative.
it("skips Gmail entirely when CRM excludes everyone, preserving CRM failures", async () => {
  const email = provider();
  const search = vi.fn(() =>
    (async function* () {
      yield "unused";
    })(),
  );
  email.searchThreads = search;
  const crm = snapshot();
  crm.contacts = crm.contacts.map((c) => ({
    ...c,
    associationsComplete: false,
  }));
  const result = await executeSegment(spec, crm, email, [lender]);
  expect(search).not.toHaveBeenCalled();
  expect(email.getThread).not.toHaveBeenCalled();
  expect(result.counts.failures).toBe(result.failures.length);
  expect(result.counts.failures).toBeGreaterThan(0);
});
it("passes primary and secondary eligible identities to Gmail without changing identity semantics", async () => {
  const email = provider();
  const search = vi.fn(() =>
    (async function* () {
      yield "thread-1";
    })(),
  );
  email.searchThreads = search;
  const crm = snapshot();
  crm.contacts[0].emails = [
    "Primary@example.test",
    "secondary+tag@example.test",
  ];
  await executeSegment(spec, crm, email, [lender]);
  expect(search).toHaveBeenCalledWith(spec, [
    "primary@example.test",
    "secondary+tag@example.test",
  ]);
});
