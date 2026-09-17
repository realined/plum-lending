import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GmailProvider } from "@/providers/gmail";
import {
  parseGmailSeedPolicy,
  type GmailSeedPolicy,
} from "@/providers/gmail-seed-policy";
import { DataBoundaryError } from "@/domain/data-boundary";
import { gmailAccessConfig, loadGmailSeedPolicy } from "@/server/gmail-access";
import { liveProviders } from "@/server/connections";
import { safeRunError } from "@/server/job-errors";
import { executeSegment } from "@/domain/executor";
import { toCsv } from "@/domain/csv";
import { DEFAULT_QUERY, parseDemo } from "@/domain/segment";

const mailbox = "lender@example.test";
const namespace = "plum-poc-test-v1";
const threadId = "aaaabbbb11112222";
const messageIds = ["1111222233334444", "5555666677778888"];
const privateId = "9999aaaabbbbcccc";
const privateSentinel = "PRIVATE CORRESPONDENCE MUST NEVER BE REQUESTED";
const receipt = (): GmailSeedPolicy => ({
  version: 1,
  mailbox,
  namespace,
  labelId: "Label_synthetic_poc",
  threads: [
    {
      id: threadId,
      messages: messageIds.map((id, i) => ({
        id,
        rfcMessageId: `<${namespace}.message-${i}@example.test>`,
      })),
    },
  ],
});
const response = (data: unknown) =>
  new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
const fetchMock = vi.fn<typeof fetch>();
let directory: string;
let calls: URL[];
function message(index: number) {
  return {
    id: messageIds[index],
    threadId,
    // Full context deliberately includes a final reply outside the qualifying window.
    internalDate: String(
      Date.parse(index ? "2026-08-01T12:00:00Z" : "2025-03-01T12:00:00Z"),
    ),
    payload: {
      mimeType: "text/plain",
      headers: [
        { name: "From", value: index ? mailbox : "sponsor@example.test" },
        { name: "To", value: index ? "sponsor@example.test" : mailbox },
        {
          name: "Subject",
          value: `[${namespace}] Fictional financing inquiry`,
        },
        {
          name: "Message-ID",
          value: receipt().threads[0].messages[index].rfcMessageId,
        },
        { name: "X-Plum-Poc-Namespace", value: namespace },
      ],
      body: {
        data: Buffer.from(
          index ? "Synthetic final response" : "Synthetic initial inquiry",
        ).toString("base64url"),
      },
    },
  };
}
function metadata(ids = messageIds) {
  return { id: threadId, messages: ids.map((id) => ({ id, threadId })) };
}
function route(override?: (url: URL) => Response | undefined) {
  fetchMock.mockImplementation(async (input) => {
    const url = new URL(String(input));
    calls.push(url);
    const overridden = override?.(url);
    if (overridden) return overridden;
    if (url.pathname.endsWith("/profile"))
      return response({ emailAddress: mailbox, historyId: "123" });
    if (url.pathname.endsWith("/threads"))
      return response({ threads: [{ id: threadId }] });
    if (url.pathname.endsWith(`/threads/${threadId}`)) {
      expect(url.searchParams.get("format")).toBe("minimal");
      expect(url.searchParams.get("fields")).toBe("id,messages(id,threadId)");
      return response(metadata());
    }
    const index = messageIds.findIndex((id) =>
      url.pathname.endsWith(`/messages/${id}`),
    );
    if (index >= 0) {
      expect(url.searchParams.get("format")).toBe("full");
      expect(url.searchParams.get("fields")).toBe(
        "id,threadId,internalDate,payload",
      );
      return response(message(index));
    }
    if (url.pathname.endsWith(`/messages/${privateId}`))
      return response({ body: privateSentinel });
    throw new Error("Unapproved network operation");
  });
}
function provider(policy = receipt()) {
  return new GmailProvider(async () => "synthetic-token", [mailbox], policy);
}
async function collect<T>(values: AsyncIterable<T>) {
  const out: T[] = [];
  for await (const value of values) out.push(value);
  return out;
}
const spec = parseDemo(DEFAULT_QUERY);
beforeEach(async () => {
  calls = [];
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  directory = await mkdtemp(join(tmpdir(), "plum-seed-policy-"));
  vi.stubEnv("GMAIL_EXPECTED_MAILBOX", mailbox);
  vi.stubEnv("GMAIL_DATA_SCOPE", "seed-only");
  vi.stubEnv("GMAIL_SEED_MANIFEST_PATH", join(directory, "manifest.json"));
  route();
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});

describe("protected Gmail access", () => {
  it("requires an exact mailbox and valid private receipt before any provider access", async () => {
    await expect(liveProviders()).rejects.toBeInstanceOf(DataBoundaryError);
    expect(fetchMock).not.toHaveBeenCalled();
    await writeFile(
      join(directory, "manifest.json"),
      JSON.stringify(receipt()),
    );
    expect(await loadGmailSeedPolicy()).toEqual(receipt());
    vi.stubEnv("GMAIL_EXPECTED_MAILBOX", "other@example.test");
    await expect(loadGmailSeedPolicy()).rejects.toBeInstanceOf(
      DataBoundaryError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("defaults to seed-only and refuses invalid mode or missing mailbox", () => {
    vi.stubEnv("GMAIL_DATA_SCOPE", undefined);
    expect(gmailAccessConfig().scope).toBe("seed-only");
    vi.stubEnv("GMAIL_DATA_SCOPE", "typo");
    expect(gmailAccessConfig).toThrow(DataBoundaryError);
    vi.stubEnv("GMAIL_DATA_SCOPE", "seed-only");
    vi.stubEnv("GMAIL_EXPECTED_MAILBOX", "");
    expect(gmailAccessConfig).toThrow(DataBoundaryError);
  });
  it.each([
    "invalid-json",
    "empty",
    "duplicate-thread",
    "duplicate-message",
    "duplicate-rfc",
    "bad-rfc",
    "bad-namespace",
    "unsafe-id",
  ])(
    "fails closed for %s receipts without exposing their content",
    async (kind) => {
      const data = receipt();
      if (kind === "empty") data.threads = [];
      if (kind === "duplicate-thread")
        data.threads.push(structuredClone(data.threads[0]));
      if (kind === "duplicate-message")
        data.threads[0].messages[1].id = messageIds[0];
      if (kind === "duplicate-rfc")
        data.threads[0].messages[1].rfcMessageId =
          data.threads[0].messages[0].rfcMessageId;
      if (kind === "bad-rfc")
        data.threads[0].messages[0].rfcMessageId = "<unapproved@example.test>";
      if (kind === "bad-namespace") data.namespace = "in:anywhere";
      if (kind === "unsafe-id") data.threads[0].id = "../profile";
      await writeFile(
        join(directory, "manifest.json"),
        kind === "invalid-json" ? privateSentinel : JSON.stringify(data),
      );
      await expect(loadGmailSeedPolicy()).rejects.toThrow("SEED_DATA_BOUNDARY");
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
  it("checks the token's actual mailbox before candidate search", async () => {
    route((url) =>
      url.pathname.endsWith("/profile")
        ? response({ emailAddress: "unapproved@example.test", historyId: "1" })
        : undefined,
    );
    await expect(
      collect(provider().searchThreads(spec, ["sponsor@example.test"])),
    ).rejects.toBeInstanceOf(DataBoundaryError);
    expect(calls.map((url) => url.pathname.split("/").at(-1))).toEqual([
      "profile",
    ]);
  });
  it("searches only the seed label with IDs-only responses and existing CRM/date narrowing", async () => {
    expect(
      await collect(provider().searchThreads(spec, ["sponsor@example.test"])),
    ).toEqual([threadId]);
    const list = calls.find((url) => url.pathname.endsWith("/threads"))!;
    expect(list.searchParams.get("labelIds")).toBe(receipt().labelId);
    expect(list.searchParams.get("fields")).toBe("threads(id),nextPageToken");
    expect(list.searchParams.get("q")).toContain('from:"sponsor@example.test"');
    expect(list.searchParams.get("q")).toContain("after:");
  });
  it("rejects an unrelated thread accidentally carrying the seed label without fetching it", async () => {
    route((url) =>
      url.pathname.endsWith("/threads")
        ? response({ threads: [{ id: privateId }] })
        : undefined,
    );
    await expect(
      collect(provider().searchThreads(spec, ["sponsor@example.test"])),
    ).rejects.toBeInstanceOf(DataBoundaryError);
    expect(calls).toHaveLength(2);
  });
  it("rejects direct access to any non-allowlisted thread with zero network calls", async () => {
    await expect(provider().getThread(privateId)).rejects.toBeInstanceOf(
      DataBoundaryError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["extra", "missing", "duplicate", "wrong-thread"])(
    "blocks %s thread membership before retrieving any body",
    async (kind) => {
      const value = metadata(
        kind === "extra"
          ? [...messageIds, privateId]
          : kind === "missing"
            ? [messageIds[0]]
            : kind === "duplicate"
              ? [messageIds[0], messageIds[0]]
              : messageIds,
      );
      if (kind === "wrong-thread") value.messages[0].threadId = privateId;
      route((url) =>
        url.pathname.endsWith(`/threads/${threadId}`)
          ? response(value)
          : undefined,
      );
      await expect(provider().getThread(threadId)).rejects.toBeInstanceOf(
        DataBoundaryError,
      );
      expect(calls.some((url) => url.pathname.includes("/messages/"))).toBe(
        false,
      );
    },
  );
  it("fetches only allowlisted message bodies if a private reply arrives during retrieval, then aborts", async () => {
    let membershipCalls = 0;
    route((url) =>
      url.pathname.endsWith(`/threads/${threadId}`)
        ? response(
            metadata(
              ++membershipCalls === 2 ? [...messageIds, privateId] : messageIds,
            ),
          )
        : undefined,
    );
    await expect(provider().getThread(threadId)).rejects.toBeInstanceOf(
      DataBoundaryError,
    );
    expect(
      calls
        .filter((url) => url.pathname.includes("/messages/"))
        .map((url) => url.pathname.split("/").at(-1)),
    ).toEqual(messageIds);
    expect(calls.some((url) => url.pathname.includes(privateId))).toBe(false);
  });
  it.each(["id", "namespace", "rfc", "subject"])(
    "rejects a %s mismatch without normalization/publication",
    async (kind) => {
      const value = message(0);
      if (kind === "id") value.id = privateId;
      if (kind === "namespace")
        value.payload.headers.find(
          (h) => h.name === "X-Plum-Poc-Namespace",
        )!.value = "unapproved";
      if (kind === "rfc")
        value.payload.headers.find((h) => h.name === "Message-ID")!.value =
          "<wrong@example.test>";
      if (kind === "subject")
        value.payload.headers.find((h) => h.name === "Subject")!.value =
          "Unmarked message";
      route((url) =>
        url.pathname.endsWith(`/messages/${messageIds[0]}`)
          ? response(value)
          : undefined,
      );
      await expect(provider().getThread(threadId)).rejects.toBeInstanceOf(
        DataBoundaryError,
      );
      expect(calls.some((url) => url.pathname.includes(privateId))).toBe(false);
    },
  );
  it("retains complete synthetic context through deterministic filtering and CSV", async () => {
    const result = await executeSegment(
      spec,
      {
        contacts: [
          {
            id: "c1",
            firstName: "Synthetic",
            lastName: "Sponsor",
            emails: ["sponsor@example.test"],
            role: "Sponsor",
            companyIds: ["a1"],
            dealIds: [],
            associationsComplete: true,
          },
        ],
        companies: [{ id: "a1", name: "Fictional Company" }],
        deals: [],
        failures: [],
        capturedAt: new Date().toISOString(),
      },
      provider(),
      [mailbox],
    );
    expect(result.rows).toHaveLength(1);
    expect(
      result.rows[0].raw.messages.map((item) => item.providerMessageId),
    ).toEqual(messageIds);
    const csv = toCsv(result.rows);
    expect(csv).toContain("Synthetic initial inquiry");
    expect(csv).toContain("Synthetic final response");
    expect(csv).not.toContain(privateSentinel);
    expect(calls.some((url) => url.pathname.includes(privateId))).toBe(false);
  });
  it("never reads mailbox-wide history in protected mode", async () => {
    expect(await provider().synchronize("123")).toEqual({
      threadIds: [],
      deletedMessageIds: [],
      nextCursor: "123",
      requiresFullSync: true,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("copies the receipt so caller mutation cannot expand permissions", async () => {
    const original = receipt();
    const guarded = provider(original);
    original.threads.push({ id: privateId, messages: [] });
    await expect(guarded.getThread(privateId)).rejects.toBeInstanceOf(
      DataBoundaryError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("returns only fixed, actionable error text", () => {
    expect(safeRunError(new DataBoundaryError(), "gmail")).toContain(
      "No export was published",
    );
    expect(safeRunError(new DataBoundaryError(), "gmail")).not.toContain(
      mailbox,
    );
    expect(() => parseGmailSeedPolicy({ secret: privateSentinel })).toThrow(
      "SEED_DATA_BOUNDARY",
    );
  });
});
