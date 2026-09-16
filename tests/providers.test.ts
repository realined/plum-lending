import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { executeSegment } from "@/domain/executor";
import {
  cleanHtml,
  gmailThreadSchema,
  htmlToText,
  normalizeGmailThread,
} from "@/domain/normalize";
import { DEFAULT_QUERY, parseDemo } from "@/domain/segment";
import { GmailProvider } from "@/providers/gmail";
import { HubSpotProvider } from "@/providers/hubspot";
import { fetchJson, ProviderError } from "@/providers/http";

const lender = "lender@example.test";
const spec = parseDemo(DEFAULT_QUERY);
const fetchMock = vi.fn<typeof fetch>();
const token = "synthetic-test-token-not-valid";
const json = (data: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
const encode = (text: string) => Buffer.from(text).toString("base64url");
type GmailMessage = z.infer<typeof gmailThreadSchema>["messages"][number];

function gmailMessage(overrides: Partial<GmailMessage> = {}): GmailMessage {
  return {
    id: "message-1",
    threadId: "thread-1",
    internalDate: String(Date.parse("2025-03-01T12:00:00.000Z")),
    payload: {
      mimeType: "text/plain",
      headers: [
        { name: "From", value: '"Synthetic Sponsor" <sponsor@example.test>' },
        { name: "To", value: lender },
        { name: "Subject", value: "Synthetic conversation" },
      ],
      body: { data: encode("Synthetic plain text."), size: 21 },
    },
    ...overrides,
  };
}
function rawThread(
  messages: GmailMessage[] = [gmailMessage()],
  id = "thread-1",
) {
  return { id, messages };
}
function crmObject(id: string, properties: Record<string, string | null>) {
  return { id, properties };
}
async function collect<T>(items: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of items) result.push(item);
  return result;
}
function routeFetch(
  handler: (url: URL, init?: RequestInit) => Response | Promise<Response>,
) {
  fetchMock.mockImplementation(async (input, init) =>
    handler(new URL(String(input)), init),
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Gmail provider contracts", () => {
  it("validates the mailbox identity and initial history cursor with read-only authorization", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ emailAddress: lender, historyId: "100" }),
    );
    const getToken = vi.fn(async () => token);
    expect(
      await new GmailProvider(getToken, [lender]).validateConnection(),
    ).toEqual({ mailbox: lender, cursor: "100" });
    expect(getToken).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://gmail.googleapis.com/gmail/v1/users/me/profile");
    expect(init?.method).toBeUndefined();
    expect(init?.headers).toEqual({ Authorization: `Bearer ${token}` });
    expect(init?.cache).toBe("no-store");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });
  it("follows every thread page and broadens search epoch boundaries around exact eligibility", async () => {
    routeFetch((url) =>
      url.searchParams.get("pageToken") === "synthetic-next"
        ? json({ threads: [{ id: "second" }] })
        : json({ threads: [{ id: "first" }], nextPageToken: "synthetic-next" }),
    );
    expect(
      await collect(
        new GmailProvider(async () => token, [lender]).searchThreads(spec, [
          "sponsor@example.test",
        ]),
      ),
    ).toEqual(["first", "second"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [input] of fetchMock.mock.calls) {
      const url = new URL(String(input));
      expect(url.pathname).toBe("/gmail/v1/users/me/threads");
      expect(url.searchParams.get("maxResults")).toBe("100");
      expect(url.searchParams.get("q")).toBe(
        `after:${Math.floor(Date.parse(spec.startInclusive) / 1000) - 1} before:${Math.ceil(Date.parse(spec.endExclusive) / 1000) + 1} {from:"sponsor@example.test"}`,
      );
    }
  });
  it("accepts an empty Gmail result and rejects repeating pagination tokens", async () => {
    fetchMock.mockResolvedValueOnce(json({}));
    const provider = new GmailProvider(async () => token, [lender]);
    expect(
      await collect(provider.searchThreads(spec, ["sponsor@example.test"])),
    ).toEqual([]);
    fetchMock.mockImplementation(async () =>
      json({ threads: [], nextPageToken: "loop" }),
    );
    await expect(
      collect(provider.searchThreads(spec, ["sponsor@example.test"])),
    ).rejects.toMatchObject({
      code: "PAGINATION_LOOP",
    });
  });
  it("batches CRM identities, deduplicates threads, and never searches with no senders", async () => {
    const provider = new GmailProvider(async () => token, [lender]);
    expect(await collect(provider.searchThreads(spec, []))).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockImplementation(async () =>
      json({ threads: [{ id: "same-thread" }] }),
    );
    const senders = Array.from(
      { length: 21 },
      (_, i) => `sponsor${i}@example.test`,
    );
    expect(
      await collect(
        provider.searchThreads(spec, [...senders, "SPONSOR0@example.test"]),
      ),
    ).toEqual(["same-thread"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const queries = fetchMock.mock.calls.map(([input]) =>
      new URL(String(input)).searchParams.get("q")!,
    );
    expect((queries[0].match(/from:/g) ?? []).length).toBe(20);
    expect(queries[1]).toContain('from:"sponsor20@example.test"');
    expect(queries.join(" ")).not.toContain("SPONSOR0");
    fetchMock.mockClear();
    await expect(
      collect(
        provider.searchThreads(spec, ["sender@example.test} OR in:anywhere"]),
      ),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("requests full thread content, hydrates external text bodies, and leaves binary attachments unfetched", async () => {
    const message = gmailMessage();
    message.payload = {
      ...message.payload,
      mimeType: "multipart/mixed",
      body: undefined,
      parts: [
        {
          mimeType: "text/plain",
          body: { attachmentId: "external-text", size: 22 },
        },
        {
          mimeType: "application/pdf",
          filename: "synthetic.pdf",
          body: { attachmentId: "binary-file", size: 321 },
        },
      ],
    };
    routeFetch((url) => {
      if (url.pathname.endsWith("/threads/thread-1")) {
        expect(url.searchParams.get("format")).toBe("full");
        return json(rawThread([message]));
      }
      if (
        url.pathname.endsWith("/messages/message-1/attachments/external-text")
      )
        return json({ data: encode("Hydrated synthetic body") });
      throw new Error("Unexpected attachment fetch");
    });
    const result = await new GmailProvider(
      async () => token,
      [lender],
    ).getThread("thread-1");
    expect(result.messages[0].text).toBe("Hydrated synthetic body");
    expect(result.messages[0].attachments).toEqual([
      {
        providerAttachmentId: "binary-file",
        filename: "synthetic.pdf",
        mimeType: "application/pdf",
        size: 321,
      },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("rejects an oversized external body before downloading it", async () => {
    const message = gmailMessage();
    message.payload.body = { attachmentId: "too-large", size: 3_000_001 };
    fetchMock.mockResolvedValueOnce(json(rawThread([message])));
    await expect(
      new GmailProvider(async () => token, [lender]).getThread("thread-1"),
    ).rejects.toMatchObject({ code: "BODY_LIMIT" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it("does not hydrate a text attachment identified by Content-Disposition without a filename", async () => {
    const message = gmailMessage();
    message.payload = {
      ...message.payload,
      mimeType: "multipart/mixed",
      body: undefined,
      parts: [
        {
          mimeType: "text/plain",
          body: { data: encode("Actual synthetic body") },
        },
        {
          mimeType: "text/plain",
          headers: [{ name: "Content-Disposition", value: "attachment" }],
          body: { attachmentId: "text-file", size: 100 },
        },
      ],
    };
    routeFetch((url) =>
      url.pathname.endsWith("/threads/thread-1")
        ? json(rawThread([message]))
        : json({ data: encode("Synthetic attachment content") }),
    );
    const result = await new GmailProvider(
      async () => token,
      [lender],
    ).getThread("thread-1");
    expect(result.messages[0].text).toBe("Actual synthetic body");
    expect(result.messages[0].attachments).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it("collects paginated history changes, deduplicates stable IDs, and advances the cursor", async () => {
    routeFetch((url) => {
      expect(url.searchParams.get("startHistoryId")).toBe("100");
      expect(url.searchParams.get("maxResults")).toBe("500");
      return url.searchParams.has("pageToken")
        ? json({
            historyId: "120",
            history: [
              {
                messagesAdded: [
                  { message: { id: "message-2", threadId: "thread-1" } },
                  { message: { id: "message-3", threadId: "thread-2" } },
                ],
                messagesDeleted: [{ message: { id: "removed-1" } }],
              },
            ],
          })
        : json({
            historyId: "110",
            nextPageToken: "history-next",
            history: [
              {
                messagesAdded: [
                  { message: { id: "message-1", threadId: "thread-1" } },
                ],
                messagesDeleted: [{ message: { id: "removed-1" } }],
              },
            ],
          });
    });
    expect(
      await new GmailProvider(async () => token, [lender]).synchronize("100"),
    ).toEqual({
      threadIds: ["thread-1", "thread-2"],
      deletedMessageIds: ["removed-1"],
      nextCursor: "120",
      requiresFullSync: false,
    });
  });
  it("requests full synchronization when Gmail rejects an expired history cursor", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ error: "synthetic expired cursor" }, 404),
    );
    expect(
      await new GmailProvider(async () => token, [lender]).synchronize(
        "expired",
      ),
    ).toEqual({
      threadIds: [],
      deletedMessageIds: [],
      nextCursor: "expired",
      requiresFullSync: true,
    });
  });
  it("does not mistake authentication failure for an expired history cursor", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ error: "synthetic auth failure" }, 401),
    );
    await expect(
      new GmailProvider(async () => token, [lender]).synchronize("100"),
    ).rejects.toMatchObject({ code: "PROVIDER_AUTH", status: 401 });
  });
});

describe("full Gmail MIME normalization", () => {
  it("decodes encoded-word headers, addresses, Latin-1 text, safe HTML, and attachment metadata", async () => {
    const message = gmailMessage({
      payload: {
        mimeType: "multipart/mixed",
        headers: [
          {
            name: "From",
            value: "=?UTF-8?B?U3ludGhldGljIENhZsOp?= <SPONSOR@EXAMPLE.TEST>",
          },
          { name: "To", value: '"Other Synthetic" <other@example.test>' },
          { name: "Cc", value: '"Synthetic Lender" <LENDER@EXAMPLE.TEST>' },
          { name: "Bcc", value: "audit@example.test" },
          { name: "Subject", value: "=?UTF-8?B?U3ludGhldGljIGNhZsOp?=" },
        ],
        parts: [
          {
            mimeType: "multipart/alternative",
            parts: [
              {
                mimeType: "text/plain",
                headers: [
                  {
                    name: "Content-Type",
                    value: 'text/plain; charset="iso-8859-1"',
                  },
                ],
                body: {
                  data: Buffer.from("Café synthetic body", "latin1").toString(
                    "base64url",
                  ),
                },
              },
              {
                mimeType: "text/html",
                body: {
                  data: encode(
                    '<p onclick="unsafe()">Café <b>synthetic</b></p><script>unsafe()</script><img src="https://example.test/tracker"><a href="javascript:unsafe()">link</a>',
                  ),
                },
              },
            ],
          },
          {
            mimeType: "application/pdf",
            filename: "synthetic.pdf",
            body: { attachmentId: "attachment-1", size: 42 },
          },
          {
            mimeType: "text/plain",
            headers: [{ name: "Content-Disposition", value: "attachment" }],
            body: {
              data: encode("Attachment must not become the body"),
              size: 35,
            },
          },
        ],
      },
    });
    const result = await normalizeGmailThread(rawThread([message]), [lender]);
    expect(result.subject).toBe("Synthetic café");
    expect(result.messages[0]).toMatchObject({
      from: { email: "sponsor@example.test", name: "Synthetic Café" },
      cc: [{ email: lender, name: "Synthetic Lender" }],
      bcc: [{ email: "audit@example.test", name: "" }],
      direction: "inbound",
      text: "Café synthetic body",
      timestamp: "2025-03-01T12:00:00.000Z",
    });
    expect(result.messages[0].sanitizedHtml).toBe(
      "<p>Café <b>synthetic</b></p>link",
    );
    expect(result.messages[0].attachments).toEqual([
      {
        providerAttachmentId: "attachment-1",
        filename: "synthetic.pdf",
        mimeType: "application/pdf",
        size: 42,
      },
      {
        providerAttachmentId: null,
        filename: "attachment",
        mimeType: "text/plain",
        size: 35,
      },
    ]);
  });
  it("produces readable text when only HTML is available", async () => {
    const message = gmailMessage();
    message.payload.mimeType = "text/html";
    message.payload.body = {
      data: encode(
        "<div>First &amp; second</div><p>Third&nbsp;line<br>Fourth</p>",
      ),
    };
    const result = await normalizeGmailThread(rawThread([message]), [lender]);
    expect(result.messages[0].text).toBe(
      "First & second\nThird\u00a0line\nFourth",
    );
    expect(
      cleanHtml(
        '<iframe src="https://example.test"></iframe><style>hidden</style><p id="x">Visible</p>',
      ),
    ).toBe("<p>Visible</p>");
    expect(
      htmlToText("<p>&lt;quoted&gt; &quot;value&quot; &#39;test&#39;</p>"),
    ).toBe("<quoted> \"value\" 'test'");
  });
  it("deduplicates stable message IDs and orders full thread context chronologically", async () => {
    const late = gmailMessage({
      id: "later",
      internalDate: String(Date.parse("2026-08-01T12:00:00.000Z")),
    });
    late.payload.headers = [
      { name: "From", value: lender },
      { name: "To", value: "sponsor@example.test" },
      { name: "Subject", value: "Later reply" },
    ];
    const first = gmailMessage({ id: "earlier" });
    const result = await normalizeGmailThread(rawThread([late, first, first]), [
      lender,
    ]);
    expect(
      result.messages.map((m) => [
        m.providerMessageId,
        m.position,
        m.direction,
      ]),
    ).toEqual([
      ["earlier", 0, "inbound"],
      ["later", 1, "outbound"],
    ]);
    expect(result.subject).toBe("Synthetic conversation");
  });
  it("marks unrelated correspondence as other and rejects thread identity mismatches or missing senders", async () => {
    const unrelated = gmailMessage();
    unrelated.payload.headers = [
      { name: "From", value: "sponsor@example.test" },
      { name: "To", value: "unrelated@example.test" },
    ];
    expect(
      (await normalizeGmailThread(rawThread([unrelated]), [lender])).messages[0]
        .direction,
    ).toBe("other");
    await expect(
      normalizeGmailThread(
        rawThread([gmailMessage({ threadId: "wrong-thread" })]),
        [lender],
      ),
    ).rejects.toThrow("THREAD_ID_MISMATCH");
    await expect(
      normalizeGmailThread(
        rawThread([
          gmailMessage({ payload: { mimeType: "text/plain", headers: [] } }),
        ]),
        [lender],
      ),
    ).rejects.toThrow("MISSING_SENDER");
  });
  it("flattens header line breaks so provider header values cannot inject recipients", async () => {
    const message = gmailMessage();
    message.payload.headers = [
      { name: "From", value: "sponsor@example.test" },
      { name: "To", value: "other@example.test" },
      { name: "Subject", value: `Synthetic subject\r\nBcc: ${lender}` },
    ];
    const result = await normalizeGmailThread(rawThread([message]), [lender]);
    expect(result.messages[0].bcc).toEqual([]);
    expect(result.messages[0].direction).toBe("other");
  });
});

describe("HubSpot read-only provider contracts", () => {
  it("validates read access to contacts, the Sponsor property, companies, deals, and pipelines", async () => {
    fetchMock.mockImplementation(async () => json({ results: [] }));
    await new HubSpotProvider(token).validateConnection();
    expect(
      fetchMock.mock.calls.map(([input]) => new URL(String(input)).pathname),
    ).toEqual([
      "/crm/v3/objects/contacts",
      "/crm/v3/properties/contacts/contact_type",
      "/crm/v3/objects/companies",
      "/crm/v3/objects/deals",
      "/crm/v3/pipelines/deals",
    ]);
    expect(
      fetchMock.mock.calls.every(
        ([, init]) => init?.method === undefined && init?.body === undefined,
      ),
    ).toBe(true);
  });
  it("rejects connection validation if company read access is missing", async () => {
    routeFetch((url) =>
      url.pathname === "/crm/v3/objects/companies"
        ? json({}, 403)
        : json({ results: [] }),
    );
    await expect(
      new HubSpotProvider(token).validateConnection(),
    ).rejects.toMatchObject({ code: "PROVIDER_REQUEST", status: 403 });
  });
  it("follows contact and company pagination, normalizes aliases and deduplicates object IDs", async () => {
    routeFetch((url) => {
      expect(url.searchParams.get("archived")).toBe("false");
      expect(url.searchParams.get("limit")).toBe("100");
      if (url.pathname.endsWith("/contacts"))
        return url.searchParams.has("after")
          ? json({
              results: [
                crmObject("contact-1", {
                  email: "sponsor@example.test",
                  hs_additional_emails:
                    " ALIAS@EXAMPLE.TEST ; sponsor@example.test ",
                  contact_type: "Sponsor",
                  firstname: "Updated",
                }),
                crmObject("contact-2", {
                  email: "other@example.test",
                  contact_type: "Lender",
                }),
              ],
            })
          : json({
              results: [
                crmObject("contact-1", {
                  email: "sponsor@example.test",
                  contact_type: "Sponsor",
                  firstname: "Old",
                }),
              ],
              paging: { next: { after: 123 } },
            });
      if (url.pathname.endsWith("/companies"))
        return url.searchParams.has("after")
          ? json({ results: [crmObject("company-2", { name: null })] })
          : json({
              results: [crmObject("company-1", { name: "Synthetic Holdings" })],
              paging: { next: { after: "company-next" } },
            });
      throw new Error("Unexpected path");
    });
    const provider = new HubSpotProvider(token);
    const contacts = await provider.searchContacts();
    expect(contacts).toHaveLength(2);
    expect(contacts[0]).toMatchObject({
      id: "contact-1",
      firstName: "Updated",
      role: "Sponsor",
      associationsComplete: false,
    });
    expect(new Set(contacts[0].emails)).toEqual(
      new Set(["sponsor@example.test", "alias@example.test"]),
    );
    expect(await provider.getCompanies()).toEqual([
      { id: "company-1", name: "Synthetic Holdings" },
      { id: "company-2", name: "Unnamed company" },
    ]);
    expect(
      fetchMock.mock.calls.map(([input]) =>
        new URL(String(input)).searchParams.get("after"),
      ),
    ).toEqual([null, "123", null, "company-next"]);
    expect(
      fetchMock.mock.calls.every(
        ([, init]) => init?.method === undefined && init?.body === undefined,
      ),
    ).toBe(true);
  });
  it("follows both association page streams and deduplicates numeric/string IDs", async () => {
    routeFetch((url) => {
      expect(url.pathname).toContain("/contacts/contact%2F1/associations/");
      expect(url.searchParams.get("limit")).toBe("500");
      if (url.pathname.endsWith("/companies"))
        return url.searchParams.has("after")
          ? json({ results: [{ toObjectId: "101" }, { toObjectId: 102 }] })
          : json({
              results: [{ toObjectId: 101 }],
              paging: { next: { after: "next-company" } },
            });
      return url.searchParams.has("after")
        ? json({ results: [{ toObjectId: 202 }] })
        : json({
            results: [{ toObjectId: 201 }],
            paging: { next: { after: 200 } },
          });
    });
    expect(
      await new HubSpotProvider(token).getAssociations("contact/1"),
    ).toEqual({ companyIds: ["101", "102"], dealIds: ["201", "202"] });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
  it("maps custom pipeline stage metadata and never guesses unknown status from a label", async () => {
    const stages = [
      { id: "custom-won", metadata: { isClosed: "true", probability: "1" } },
      { id: "custom-lost", metadata: { isClosed: true, probability: 0 } },
      {
        id: "custom-open",
        metadata: { isClosed: "false", probability: "0.7" },
      },
      {
        id: "closed-ambiguous",
        metadata: { isClosed: true, probability: "0.5" },
      },
      { id: "Closed Won", metadata: {} },
    ];
    routeFetch((url) => {
      if (url.pathname.endsWith("/pipelines/deals"))
        return json({
          results: [
            { id: "custom-pipeline", stages },
            {
              id: "other-pipeline",
              stages: [
                {
                  id: "custom-won",
                  metadata: { isClosed: true, probability: 0 },
                },
              ],
            },
          ],
        });
      if (url.searchParams.has("after"))
        return json({
          results: [
            crmObject("other-pipeline-deal", {
              pipeline: "other-pipeline",
              dealstage: "custom-won",
            }),
            crmObject("missing-stage", {
              pipeline: "custom-pipeline",
              dealstage: "not-returned",
            }),
          ],
        });
      return json({
        results: stages.map((stage) =>
          crmObject(stage.id, {
            pipeline: "custom-pipeline",
            dealstage: stage.id,
          }),
        ),
        paging: { next: { after: "deals-next" } },
      });
    });
    expect(
      (await new HubSpotProvider(token).getDeals()).map((d) => [
        d.id,
        d.status,
      ]),
    ).toEqual([
      ["custom-won", "won"],
      ["custom-lost", "lost"],
      ["custom-open", "open"],
      ["closed-ambiguous", "unknown"],
      ["Closed Won", "unknown"],
      ["other-pipeline-deal", "lost"],
      ["missing-stage", "unknown"],
    ]);
  });
  it("detects repeated object and association pagination cursors", async () => {
    const provider = new HubSpotProvider(token);
    fetchMock.mockImplementation(async () =>
      json({ results: [], paging: { next: { after: "loop" } } }),
    );
    await expect(provider.getCompanies()).rejects.toMatchObject({
      code: "PAGINATION_LOOP",
    });
    await expect(provider.getAssociations("contact-1")).rejects.toMatchObject({
      code: "PAGINATION_LOOP",
    });
  });
  it("keeps failed association lookups incomplete so domain execution excludes them", async () => {
    routeFetch((url) => {
      if (url.pathname === "/crm/v3/objects/contacts")
        return json({
          results: [
            crmObject("contact-1", {
              email: "sponsor@example.test",
              contact_type: "Sponsor",
            }),
          ],
        });
      if (
        url.pathname === "/crm/v3/objects/companies" ||
        url.pathname === "/crm/v3/objects/deals" ||
        url.pathname === "/crm/v3/pipelines/deals"
      )
        return json({ results: [] });
      if (url.pathname.endsWith("/associations/companies"))
        return json({ results: [{ toObjectId: 101 }] });
      if (url.pathname.endsWith("/associations/deals"))
        return json({ error: "Synthetic forbidden association" }, 403);
      throw new Error("Unexpected path");
    });
    const snapshot = await new HubSpotProvider(token).snapshot();
    expect(snapshot.contacts[0]).toMatchObject({
      associationsComplete: false,
      companyIds: [],
      dealIds: [],
    });
    expect(snapshot.failures).toEqual([
      {
        scope: "contact",
        code: "ASSOCIATIONS_UNAVAILABLE",
        reference: "contact-1",
      },
    ]);
    const result = await executeSegment(
      spec,
      snapshot,
      {
        name: "demo",
        validateConnection: async () => ({ mailbox: lender }),
        async *searchThreads() {
          yield "thread-1";
        },
        getThread: async () => normalizeGmailThread(rawThread(), [lender]),
        synchronize: async () => ({
          threadIds: [],
          deletedMessageIds: [],
          nextCursor: "0",
          requiresFullSync: false,
        }),
      },
      [lender],
    );
    expect(result.rows).toEqual([]);
    expect(result.exclusions["CRM eligibility could not be verified"]).toBe(1);
  });
  it("records missing-email contacts as failures and avoids an invalid empty identity", async () => {
    routeFetch((url) =>
      json({
        results:
          url.pathname === "/crm/v3/objects/contacts"
            ? [
                crmObject("missing-email", {
                  email: null,
                  contact_type: "Sponsor",
                }),
              ]
            : [],
      }),
    );
    const snapshot = await new HubSpotProvider(token).snapshot();
    expect(snapshot.contacts).toEqual([]);
    expect(snapshot.failures).toEqual([
      {
        scope: "contact",
        code: "CONTACT_EMAIL_MISSING",
        reference: "missing-email",
      },
    ]);
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes("/associations/"),
      ),
    ).toBe(false);
  });
  it("aborts when the complete deal listing fails instead of assuming no Closed Won deals", async () => {
    routeFetch((url) =>
      url.pathname === "/crm/v3/objects/deals"
        ? json({ error: "Synthetic missing permission" }, 403)
        : json({ results: [] }),
    );
    await expect(new HubSpotProvider(token).snapshot()).rejects.toMatchObject({
      code: "PROVIDER_REQUEST",
      status: 403,
    });
  });
  it("supports a configured sponsor property/value and rejects property path injection", async () => {
    fetchMock.mockResolvedValueOnce(
      json({
        results: [
          crmObject("custom-sponsor", {
            email: "sponsor@example.test",
            business_role: "Capital Partner",
          }),
        ],
      }),
    );
    expect(
      (
        await new HubSpotProvider(
          token,
          "business_role",
          "Capital Partner",
        ).searchContacts()
      )[0].role,
    ).toBe("Sponsor");
    expect(
      new URL(String(fetchMock.mock.calls[0][0])).searchParams.get(
        "properties",
      ),
    ).toContain("business_role");
    expect(() => new HubSpotProvider(token, "role/../../secret")).toThrow(
      "INVALID_SPONSOR_PROPERTY",
    );
  });
  it("preserves the CRM primary email before aliases for the exported contact identity", async () => {
    fetchMock.mockResolvedValueOnce(
      json({
        results: [
          crmObject("contact-1", {
            email: "PRIMARY@EXAMPLE.TEST",
            hs_additional_emails: "aaa-alias@example.test;primary@example.test",
            contact_type: "Sponsor",
          }),
        ],
      }),
    );
    const contacts = await new HubSpotProvider(token).searchContacts();
    expect(contacts[0].emails).toEqual([
      "primary@example.test",
      "aaa-alias@example.test",
    ]);
  });
  it("does not accept the default Sponsor value when a different sponsor value is configured", async () => {
    fetchMock.mockResolvedValueOnce(
      json({
        results: [
          crmObject("wrong-value", {
            email: "sponsor@example.test",
            business_role: "Sponsor",
          }),
        ],
      }),
    );
    const contacts = await new HubSpotProvider(
      token,
      "business_role",
      "Capital Partner",
    ).searchContacts();
    expect(contacts[0].role.trim().toLowerCase()).not.toBe("sponsor");
  });
});

describe("safe HTTP retry behavior", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
  });
  it("honors Retry-After seconds on a rate-limited read", async () => {
    fetchMock
      .mockResolvedValueOnce(json({}, 429, { "retry-after": "2" }))
      .mockResolvedValueOnce(json({ ok: true }));
    const pending = fetchJson("https://example.test/api");
    await vi.advanceTimersByTimeAsync(1999);
    expect(fetchMock).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("honors an HTTP-date Retry-After and caps excessive waits at 30 seconds", async () => {
    vi.setSystemTime(new Date("2026-09-16T12:00:00.000Z"));
    fetchMock
      .mockResolvedValueOnce(
        json({}, 503, { "retry-after": "Wed, 16 Sep 2026 12:02:00 GMT" }),
      )
      .mockResolvedValueOnce(json({ ok: true }));
    const pending = fetchJson("https://example.test/api");
    await vi.advanceTimersByTimeAsync(29999);
    expect(fetchMock).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual({ ok: true });
  });
  it("bounds rate-limit retries and preserves a structured final failure", async () => {
    fetchMock.mockImplementation(async () =>
      json({}, 429, { "retry-after": "0" }),
    );
    const pending = expect(
      fetchJson("https://example.test/api"),
    ).rejects.toMatchObject({ code: "PROVIDER_RATE_LIMIT", status: 429 });
    await vi.runAllTimersAsync();
    await pending;
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
  it("retries transient network failures but never reveals the underlying exception text", async () => {
    fetchMock
      .mockRejectedValueOnce(
        new Error("Synthetic private payload in transport error"),
      )
      .mockResolvedValueOnce(json({ recovered: true }));
    const pending = fetchJson("https://example.test/api");
    await vi.runAllTimersAsync();
    expect(await pending).toEqual({ recovered: true });
    fetchMock.mockRejectedValue(
      new Error("Synthetic private payload in transport error"),
    );
    const failed = expect(
      fetchJson("https://example.test/api", {}, false),
    ).rejects.toMatchObject({
      code: "PROVIDER_NETWORK",
      message: "PROVIDER_NETWORK",
    });
    await failed;
  });
  it.each([401, 403, 404])(
    "does not retry permanent HTTP %i failures",
    async (status) => {
      fetchMock.mockResolvedValueOnce(
        json({ privateDetail: "Synthetic response must stay private" }, status),
      );
      await expect(fetchJson("https://example.test/api")).rejects.toMatchObject(
        { code: status === 401 ? "PROVIDER_AUTH" : "PROVIDER_REQUEST", status },
      );
      expect(fetchMock).toHaveBeenCalledOnce();
    },
  );
  it("does not retry an operation explicitly marked unsafe to retry", async () => {
    fetchMock.mockResolvedValueOnce(json({}, 429));
    await expect(
      fetchJson(
        "https://example.test/api",
        { method: "POST", body: "synthetic" },
        false,
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_RATE_LIMIT" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it("rejects malformed JSON without leaking response text", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("Synthetic private non-JSON body", { status: 200 }),
    );
    await expect(fetchJson("https://example.test/api")).rejects.toBeInstanceOf(
      ProviderError,
    );
    fetchMock.mockResolvedValueOnce(
      new Response("Synthetic private non-JSON body", { status: 200 }),
    );
    await expect(fetchJson("https://example.test/api")).rejects.toMatchObject({
      code: "PROVIDER_INVALID_JSON",
      message: "PROVIDER_INVALID_JSON",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
