import { afterEach, describe, expect, it, vi } from "vitest";
import { simpleParser } from "mailparser";
import {
  createSeedPlan,
  createExpandedSeedPlan,
  seedThreadKey,
  assertSeedPlan,
  previewSeedPlan,
  seedPlanDigest,
} from "@/seed/plan";
import { renderSeedMessage } from "@/seed/mime";
import { normalizeGmailThread } from "@/domain/normalize";
import { executeSegment } from "@/domain/executor";
import { toCsv, CSV_HEADERS } from "@/domain/csv";
import type { CRMSnapshot, Thread } from "@/domain/models";
import type { EmailProvider } from "@/providers/contracts";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("controlled live-seed proposal (offline)", () => {
  it("is deterministic, wholly fictional, and cannot fetch or load provider credentials", () => {
    const fetch = vi.fn(() => {
      throw new Error("Network must not be used");
    });
    vi.stubGlobal("fetch", fetch);
    const plan = createSeedPlan();
    expect(createSeedPlan()).toEqual(plan);
    expect(seedPlanDigest(createSeedPlan())).toBe(seedPlanDigest(plan));
    expect(plan.contacts).toHaveLength(7);
    expect(plan.contacts.filter((c) => c.deal)).toHaveLength(3);
    expect(plan.messages).toHaveLength(9);
    expect(new Set(plan.messages.map((m) => m.caseKey)).size).toBe(6);
    expect(new Set(plan.messages.map((m) => m.rfcMessageId)).size).toBe(9);
    expect(plan.expectedContactKeys).toEqual(["cedar", "willow"]);
    for (const c of plan.contacts) {
      expect(c.email).toMatch(/@example\.com$/);
      expect(c.email).toContain(plan.namespace);
      expect(c.domain).toContain(`${plan.namespace}.example.test`);
      expect(c.company).toContain(`[${plan.namespace}]`);
    }
    expect(previewSeedPlan(plan)).toContain("No credentials loaded");
    expect(previewSeedPlan(plan)).toContain("2 expected CSV rows");
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    "not-a-date",
    "2026-02-31T12:00:00.000Z",
    "2026-09-16",
    "2026-09-16T12:00:00-04:00",
  ])("rejects an ambiguous or invalid reference date: %s", (date) => {
    expect(() => createSeedPlan(date)).toThrow("INVALID_SEED_PLAN_INPUT");
  });
  it.each([
    "short",
    "../other-mail",
    "bad\r\nBcc:private",
    "Mixed-Namespace",
    "a".repeat(41),
  ])("rejects unsafe namespace: %#", (namespace) => {
    expect(() => createSeedPlan(undefined, namespace)).toThrow(
      "INVALID_SEED_PLAN_INPUT",
    );
  });
  it("changes the digest when the frozen reference date changes, while preserving the scenario relationships", () => {
    const first = createSeedPlan();
    const later = createSeedPlan("2028-02-29T12:00:00.000Z");
    expect(seedPlanDigest(first)).not.toBe(seedPlanDigest(later));
    expect(later.spec.startInclusive).toBe("2026-02-28T12:00:00.000Z");
    expect(later.messages[0].date).toBe("2027-02-28T12:00:00.000Z");
    expect(later.expectedContactKeys).toEqual(first.expectedContactKeys);
  });
  it("rejects changed proposal content instead of rendering unreviewed recipients or bodies", () => {
    const plan = createSeedPlan();
    plan.contacts[0].email = "unapproved@example.test";
    expect(() => previewSeedPlan(plan)).toThrow("SEED_PLAN_CHANGED");
    expect(() =>
      renderSeedMessage(plan, plan.messages[0], plan.lenderPlaceholder),
    ).toThrow("SEED_PLAN_CHANGED");
  });
  it("rejects mailbox header injection and messages not belonging to the proposal", () => {
    const plan = createSeedPlan();
    expect(() =>
      renderSeedMessage(
        plan,
        plan.messages[0],
        "lab@example.test\r\nBcc: stranger@example.test",
      ),
    ).toThrow("INVALID_SEED_MESSAGE_INPUT");
    expect(() =>
      renderSeedMessage(plan, { ...plan.messages[0] }, plan.lenderPlaceholder),
    ).toThrow("INVALID_SEED_MESSAGE_INPUT");
  });
  it("round-trips all MIME messages with dates, reply chains, namespace, CC and attachment content", async () => {
    const plan = createSeedPlan();
    for (const message of plan.messages) {
      const raw = renderSeedMessage(plan, message, plan.lenderPlaceholder);
      expect(raw.replaceAll("\r\n", "")).not.toContain("\n");
      expect(raw.split("\r\n").every((line) => line.length < 998)).toBe(true);
      const parsed = await simpleParser(raw);
      expect(parsed.subject).toBe(message.subject);
      expect(parsed.date?.toISOString()).toBe(message.date);
      expect(parsed.messageId).toBe(message.rfcMessageId);
      expect(parsed.headers.get("x-plum-poc-namespace")).toBe(plan.namespace);
      expect(parsed.text?.trim()).toBe(message.text);
      expect(parsed.html).toBeTruthy();
      expect(parsed.inReplyTo).toBe(message.references.at(-1));
      const actualReferences = parsed.references
        ? Array.isArray(parsed.references)
          ? parsed.references
          : [parsed.references]
        : [];
      expect(actualReferences).toEqual(message.references);
      const cc = Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc];
      expect(
        cc
          .flatMap((group) => group?.value ?? [])
          .map((identity) => identity.address),
      ).toEqual(message.cc);
      if (message.attachment) {
        expect(parsed.attachments).toHaveLength(1);
        expect(parsed.attachments[0].filename).toBe(
          message.attachment.filename,
        );
        expect(parsed.attachments[0].content.toString("utf8")).toBe(
          message.attachment.text,
        );
      } else expect(parsed.attachments).toHaveLength(0);
    }
  });

  it.each([false, true])(
    "produces the independent truth set through normalization, filtering and CSV (expanded=%s)",
    async (expanded) => {
      const plan = expanded ? createExpandedSeedPlan() : createSeedPlan();
      const threads: Thread[] = [];
      // Simulate Gmail's MIME projection after parsing the actual generated RFC content.
      // Real Gmail insertion/thread grouping remains a separate live acceptance check.
      for (const caseKey of new Set(plan.messages.map(seedThreadKey))) {
        const messages = [];
        for (const message of plan.messages.filter(
          (m) => seedThreadKey(m) === caseKey,
        )) {
          const parsed = await simpleParser(
            renderSeedMessage(plan, message, plan.lenderPlaceholder),
          );
          messages.push({
            id: message.key,
            threadId: caseKey,
            internalDate: String(parsed.date!.getTime()),
            payload: {
              mimeType: "multipart/mixed",
              headers: parsed.headerLines.map((h) => {
                const split = h.line.indexOf(":");
                return {
                  name: h.line.slice(0, split),
                  value: h.line.slice(split + 1).trim(),
                };
              }),
              parts: [
                {
                  mimeType: "text/plain",
                  body: {
                    data: Buffer.from(parsed.text!).toString("base64url"),
                  },
                },
                {
                  mimeType: "text/html",
                  body: {
                    data: Buffer.from(String(parsed.html)).toString(
                      "base64url",
                    ),
                  },
                },
                ...parsed.attachments.map((a) => ({
                  mimeType: a.contentType,
                  filename: a.filename,
                  body: { attachmentId: "synthetic-attachment", size: a.size },
                })),
              ],
            },
          });
        }
        threads.push(
          await normalizeGmailThread({ id: caseKey, messages }, [
            plan.lenderPlaceholder,
          ]),
        );
      }
      const crm: CRMSnapshot = {
        contacts: plan.contacts.map((c) => ({
          id: c.key,
          firstName: c.firstName,
          lastName: c.lastName,
          emails: [c.email],
          role: c.role,
          companyIds: [c.key],
          dealIds: c.deal ? [c.key] : [],
          associationsComplete: true,
        })),
        companies: plan.contacts.map((c) => ({ id: c.key, name: c.company })),
        deals: plan.contacts
          .filter((c) => c.deal !== null)
          .map((c) => ({
            id: c.key,
            name: `[${plan.namespace}] ${c.key}`,
            pipeline: "synthetic",
            stage: c.deal!,
            status: c.deal!,
          })),
        failures: [],
        capturedAt: plan.asOf,
      };
      const provider: EmailProvider = {
        name: "gmail",
        async validateConnection() {
          return { mailbox: plan.lenderPlaceholder };
        },
        async *searchThreads() {
          for (const thread of threads) yield thread.providerThreadId;
        },
        async getThread(id) {
          return threads.find((t) => t.providerThreadId === id)!;
        },
        async synchronize() {
          throw new Error("Not used by snapshot execution");
        },
      };
      const result = await executeSegment(plan.spec, crm, provider, [
        plan.lenderPlaceholder,
      ]);
      expect(result.rows.map((row) => row.contactId).sort()).toEqual(
        expanded
          ? [
              "alder",
              "alder",
              "cedar",
              "copper",
              "harbor",
              "harbor",
              "maple",
              "oak",
              "pine",
              "river",
              "summit",
              "willow",
            ]
          : ["cedar", "willow"],
      );
      expect(result.counts).toEqual({
        contacts: expanded ? 10 : 2,
        threads: expanded ? 12 : 2,
        messages: expanded ? 45 : 5,
        excluded: expanded ? 10 : 5,
        failures: 0,
        scannedContacts: expanded ? 20 : 7,
      });
      expect(result.exclusions["Closed Won deal"]).toBe(expanded ? 3 : 1);
      expect(result.exclusions["Not a Sponsor"]).toBe(expanded ? 2 : 1);
      const cedar = result.rows.find((row) => row.contactId === "cedar")!;
      expect(cedar.raw.messages).toHaveLength(4);
      expect(cedar.qualifyingMessageIds).toEqual(["cedar-1", "cedar-3"]);
      expect(Date.parse(cedar.lastActivity)).toBeGreaterThan(
        Date.parse(plan.spec.endExclusive),
      );
      expect(cedar.raw.messages[2].attachments[0].filename).toBe(
        "cedar-property-summary.txt",
      );
      expect(cedar.raw.messages[0].cc[0].email).toBe(
        `analyst.${plan.namespace}@example.test`,
      );
      const csv = toCsv(result.rows);
      expect(csv.split("\r\n")[0]).toBe(
        "\uFEFF" + CSV_HEADERS.map((header) => `"${header}"`).join(","),
      );
      expect(csv).toContain("outside the qualifying activity window");
      expect(csv).toContain("cedar-property-summary.txt");
      for (const excluded of [
        "granite",
        "juniper",
        "oldmill",
        "birch",
        "meadow",
      ])
        expect(csv).not.toContain(`${excluded}.${plan.namespace}@example.com`);
    },
  );
});

// Live writer contracts use synthetic provider responses; no real accounts are called.
import {
  SeedWriter,
  assertPreservedSeedState,
  newSeedState,
  WRITER_SCOPES,
  type SeedState,
} from "@/seed/writer";
import { SeedError } from "@/seed/private-files";
import { allowedSeedRequest, type SeedAPI } from "@/seed/transport";
import {
  SEED_CALLBACK,
  SEED_GMAIL_SCOPES,
  seedAuthorizationUrl,
  exchangeSeedCode,
} from "@/seed/oauth";

function seedHarness() {
  const plan = createSeedPlan();
  const target = {
    mailbox: plan.lenderPlaceholder,
    portalId: "12345",
    hubspotToken: "synthetic-writer-token",
    sponsorProperty: "contact_type",
  };
  const state = newSeedState(plan, target);
  const saved: SeedState[] = [];
  const crm: Record<
    string,
    Record<string, { id: string; properties: Record<string, string> }>
  > = { contacts: {}, companies: {}, deals: {} };
  const associations: Record<string, string[]> = {};
  const labels: { id: string; name: string }[] = [];
  const messages: Record<
    string,
    {
      id: string;
      threadId: string;
      internalDate: string;
      payload: { headers: { name: string; value: string }[] };
    }
  > = {};
  let next = 100;
  const api = vi.fn<SeedAPI>(async (service, method, route, body) => {
    if (!allowedSeedRequest(service, method, route))
      throw new Error("Unexpected endpoint");
    const path = new URL(route, "https://synthetic.invalid").pathname;
    if (service === "gmail") {
      if (path === "/profile") return { emailAddress: target.mailbox };
      if (path === "/labels" && method === "GET") return { labels };
      if (path === "/labels" && method === "POST") {
        const label = { id: "Label_synthetic", name: plan.namespace };
        labels.push(label);
        return label;
      }
      if (path.startsWith("/labels/") && method === "DELETE") {
        labels.splice(0);
        return {};
      }
      if (path === "/messages" && method === "GET")
        return {
          messages: Object.values(messages).map(({ id, threadId }) => ({
            id,
            threadId,
          })),
        };
      if (path === "/messages" && method === "POST") {
        const payload = body as {
          raw: string;
          threadId?: string;
          labelIds: string[];
        };
        const parsed = await simpleParser(
          Buffer.from(payload.raw, "base64url"),
        );
        const id = (++next).toString(16).padStart(16, "0");
        const message = {
          id,
          threadId: payload.threadId ?? id,
          internalDate: String(parsed.date!.getTime()),
          payload: {
            headers: parsed.headerLines.map((h) => ({
              name: h.line.slice(0, h.line.indexOf(":")),
              value: h.line.slice(h.line.indexOf(":") + 1).trim(),
            })),
          },
        };
        messages[id] = message;
        return { id, threadId: message.threadId };
      }
      if (path.startsWith("/messages/") && method === "GET")
        return messages[path.split("/")[2]];
      if (path.startsWith("/threads/") && method === "GET") {
        const id = path.split("/")[2];
        return {
          id,
          messages: Object.values(messages)
            .filter((m) => m.threadId === id)
            .map(({ id, threadId }) => ({ id, threadId })),
        };
      }
    } else {
      if (path.includes("access-token-info"))
        return { hubId: 12345, scopes: WRITER_SCOPES };
      if (path === "/crm/v3/properties/contacts/contact_type")
        return { name: "contact_type", type: "string", fieldType: "text" };
      if (path === "/crm/v3/pipelines/deals")
        return {
          results: [
            {
              id: "default",
              stages: [
                {
                  id: "open",
                  displayOrder: 0,
                  metadata: { isClosed: "false", probability: "0.2" },
                },
                {
                  id: "won",
                  displayOrder: 1,
                  metadata: { isClosed: "true", probability: "1" },
                },
                {
                  id: "lost",
                  displayOrder: 2,
                  metadata: { isClosed: "true", probability: "0" },
                },
              ],
            },
          ],
        };
      const object =
        /^\/crm\/v3\/objects\/(contacts|companies|deals)(?:\/(\d+))?$/.exec(
          path,
        );
      if (object) {
        const [, type, id] = object;
        if (method === "GET" && !id)
          return { results: Object.values(crm[type]) };
        if (method === "GET" && id) {
          if (!crm[type][id]) throw new SeedError("SEED_NOT_FOUND");
          return crm[type][id];
        }
        if (method === "POST") {
          const id = String(++next);
          const record = {
            id,
            properties: (body as { properties: Record<string, string> })
              .properties,
          };
          crm[type][id] = record;
          return record;
        }
        if (method === "DELETE") {
          delete crm[type][id];
          return {};
        }
      }
      const parts = path.split("/");
      if (method === "PUT") {
        associations[`${parts[5]}:${parts[8]}`] = [parts[9]];
        return {};
      }
      if (method === "GET" && path.includes("/associations/"))
        return {
          results: (associations[`${parts[5]}:${parts[7]}`] ?? []).map(
            (id) => ({ toObjectId: id }),
          ),
        };
    }
    throw new Error("Unexpected request");
  });
  const writer = new SeedWriter(api, plan, target, state, async (value) => {
    saved.push(structuredClone(value));
  });
  return { plan, target, state, saved, crm, labels, messages, api, writer };
}

describe("separate writer safety and replay contracts", () => {
  it("refuses disabled operations and wrong approval digests before any provider request", async () => {
    const h = seedHarness();
    await expect(
      h.writer.apply("false", seedPlanDigest(h.plan)),
    ).rejects.toThrow("SEED_EXPLICIT_APPROVAL_REQUIRED");
    await expect(h.writer.apply("true", "unapproved")).rejects.toThrow(
      "SEED_EXPLICIT_APPROVAL_REQUIRED",
    );
    expect(h.api).not.toHaveBeenCalled();
  });
  it("rejects the wrong Gmail account before CRM access or writes", async () => {
    const h = seedHarness();
    h.api.mockResolvedValueOnce({ emailAddress: "different@example.test" });
    await expect(
      h.writer.apply("true", seedPlanDigest(h.plan)),
    ).rejects.toThrow("SEED_GMAIL_ACCOUNT_MISMATCH");
    expect(h.api).toHaveBeenCalledTimes(1);
  });
  it("rejects the wrong HubSpot portal before record access or writes", async () => {
    const h = seedHarness();
    h.api
      .mockResolvedValueOnce({ emailAddress: h.target.mailbox })
      .mockResolvedValueOnce({ hubId: 99999, scopes: WRITER_SCOPES });
    await expect(h.writer.preflight()).rejects.toThrow(
      "SEED_HUBSPOT_ACCOUNT_MISMATCH",
    );
    expect(h.api).toHaveBeenCalledTimes(2);
  });
  it("refuses foreign CRM records instead of merging the lab with unrelated data", async () => {
    const h = seedHarness();
    h.crm.contacts["999"] = {
      id: "999",
      properties: { email: "unrelated@example.test" },
    };
    await expect(h.writer.preflight()).rejects.toThrow(
      "SEED_UNTRACKED_OR_CHANGED_CRM_RECORD",
    );
    expect(
      h.api.mock.calls.some(
        ([, method, route]) => method === "POST" && route.startsWith("/crm"),
      ),
    ).toBe(false);
  });
  it("seeds once, records insertion IDs, verifies associations/full threads, and replays without duplicate creates", async () => {
    const h = seedHarness();
    const digest = seedPlanDigest(h.plan);
    const receipt = await h.writer.apply("true", digest);
    expect(receipt.threads).toHaveLength(6);
    expect(receipt.threads.flatMap((t) => t.messages)).toHaveLength(9);
    expect(Object.keys(h.crm.contacts)).toHaveLength(7);
    expect(Object.keys(h.crm.companies)).toHaveLength(7);
    expect(Object.keys(h.crm.deals)).toHaveLength(3);
    expect(h.saved.some((state) => state.pending?.startsWith("gmail:"))).toBe(
      true,
    );
    expect(h.state.pending).toBeUndefined();
    const creates = h.api.mock.calls.filter(
      ([, method, route]) =>
        method === "POST" && !route.includes("access-token-info"),
    ).length;
    expect(await h.writer.apply("true", digest)).toEqual(receipt);
    expect(
      h.api.mock.calls.filter(
        ([, method, route]) =>
          method === "POST" && !route.includes("access-token-info"),
      ),
    ).toHaveLength(creates);
  });
  it("does not repeat an uncertain create, including after reconstructing the writer from its journal", async () => {
    const h = seedHarness();
    const original = h.api.getMockImplementation()!;
    h.api.mockImplementation(async (...args) => {
      if (args[1] === "POST" && args[2].startsWith("/crm/"))
        throw new SeedError("SEED_NETWORK_RESULT_UNCERTAIN");
      return original(...args);
    });
    await expect(
      h.writer.apply("true", seedPlanDigest(h.plan)),
    ).rejects.toThrow("SEED_NETWORK_RESULT_UNCERTAIN");
    expect(h.saved.at(-1)?.pending).toBe("companies:cedar");
    h.api.mockClear();
    const resumed = new SeedWriter(
      h.api,
      h.plan,
      h.target,
      h.saved.at(-1)!,
      async () => {},
    );
    await expect(resumed.apply("true", seedPlanDigest(h.plan))).rejects.toThrow(
      "SEED_UNCERTAIN_WRITE_INSPECTION_REQUIRED",
    );
    expect(h.api).not.toHaveBeenCalled();
  });
  it("blocks receipt publication when an unseeded message appears in a thread", async () => {
    const h = seedHarness();
    const original = h.api.getMockImplementation()!;
    h.api.mockImplementation(async (...args) => {
      if (args[0] === "gmail" && args[2].startsWith("/threads/"))
        return {
          id: args[2].split("/")[2].split("?")[0],
          messages: [{ id: "ffffffffffffffff", threadId: "ffffffffffffffff" }],
        };
      return original(...args);
    });
    await expect(
      h.writer.apply("true", seedPlanDigest(h.plan)),
    ).rejects.toThrow("SEED_MIXED_THREAD");
  });
  it("cleanup disables the receipt first, archives recorded CRM objects and removes only the seed label while retaining mail", async () => {
    const h = seedHarness();
    const digest = seedPlanDigest(h.plan);
    await h.writer.apply("true", digest);
    h.api.mockClear();
    let disabled = false;
    const original = h.api.getMockImplementation()!;
    h.api.mockImplementation(async (...args) => {
      if (args[1] === "DELETE") expect(disabled).toBe(true);
      return original(...args);
    });
    await h.writer.cleanup("true", digest, async () => {
      disabled = true;
    });
    expect(h.labels).toHaveLength(0);
    expect(Object.keys(h.messages)).toHaveLength(9);
    expect(
      Object.values(h.crm).every(
        (objects) => Object.keys(objects).length === 0,
      ),
    ).toBe(true);
    expect(h.state.cleaned).toBe(true);
    expect(
      h.api.mock.calls.filter(
        ([service, method]) => service === "gmail" && method === "DELETE",
      ),
    ).toEqual([["gmail", "DELETE", "/labels/Label_synthetic"]]);
    await expect(h.writer.apply("true", digest)).rejects.toThrow(
      "SEED_CLEANUP_ALREADY_STARTED",
    );
    const count = h.api.mock.calls.length;
    await h.writer.cleanup("true", digest, async () => {
      throw new Error("Already complete");
    });
    expect(h.api).toHaveBeenCalledTimes(count);
  });
  it.each([
    "/messages/send",
    "/messages/0000000000000001/trash",
    "/messages/0000000000000001/modify",
    "/drafts",
    "/messages/batchDelete",
    "//foreign.invalid/messages",
  ])("blocks unapproved Gmail write endpoint %s", (path) => {
    for (const method of ["POST", "DELETE", "PUT"])
      expect(allowedSeedRequest("gmail", method, path)).toBe(false);
  });
  it("blocks body retrieval and unrestricted mailbox listing", () => {
    expect(allowedSeedRequest("gmail", "GET", "/messages")).toBe(false);
    expect(
      allowedSeedRequest(
        "gmail",
        "GET",
        "/messages/0000000000000001?format=full&fields=payload",
      ),
    ).toBe(false);
    expect(
      allowedSeedRequest(
        "gmail",
        "GET",
        "/threads/0000000000000001?format=full",
      ),
    ).toBe(false);
  });
});

describe("separate seed OAuth", () => {
  const config = {
    clientId: "synthetic-writer-client",
    clientSecret: "synthetic-secret",
    readerClientId: "synthetic-reader-client",
    mailbox: "lender@example.test",
  };
  it("uses only the chosen three scopes, exact local callback, PKCE, online access and no incremental grants", () => {
    const url = new URL(
      seedAuthorizationUrl(config, "synthetic-state", "synthetic-verifier"),
    );
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("scope")?.split(" ")).toEqual(
      SEED_GMAIL_SCOPES,
    );
    expect(url.searchParams.get("redirect_uri")).toBe(SEED_CALLBACK);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("access_type")).toBe("online");
    expect(url.searchParams.get("include_granted_scopes")).toBe("false");
    expect(() =>
      seedAuthorizationUrl(
        { ...config, clientId: config.readerClientId },
        "state",
        "verifier",
      ),
    ).toThrow("SEED_SEPARATE_OAUTH_CLIENT_REQUIRED");
  });
  it("rejects a broader grant before profile retrieval or persistence", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "synthetic-token",
          expires_in: 3600,
          scope: [
            ...SEED_GMAIL_SCOPES,
            "https://www.googleapis.com/auth/gmail.modify",
          ].join(" "),
        }),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    await expect(
      exchangeSeedCode(config, "synthetic-code", "verifier"),
    ).rejects.toThrow("SEED_OAUTH_SCOPE_MISMATCH");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("rejects another mailbox even when the scopes match", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "synthetic-token",
            expires_in: 3600,
            scope: SEED_GMAIL_SCOPES.join(" "),
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ emailAddress: "different@example.test" }),
        ),
      );
    vi.stubGlobal("fetch", fetch);
    await expect(
      exchangeSeedCode(config, "synthetic-code", "verifier"),
    ).rejects.toThrow("SEED_GMAIL_ACCOUNT_MISMATCH");
  });
});

import { authorizeSeedWriter, SEED_START } from "@/seed/oauth";
import { decryptToken } from "@/server/crypto";

it("encrypts the separate short-lived access token after exact scope and account verification", async () => {
  vi.stubEnv("TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: "synthetic-seed-only-token",
          expires_in: 3600,
          scope: SEED_GMAIL_SCOPES.join(" "),
        }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ emailAddress: "lender@example.test" })),
    );
  vi.stubGlobal("fetch", fetch);
  const result = await exchangeSeedCode(
    {
      clientId: "writer",
      clientSecret: "synthetic-secret",
      readerClientId: "reader",
      mailbox: "lender@example.test",
    },
    "synthetic-code",
    "verifier",
  );
  expect(result.encryptedToken).not.toContain("synthetic-seed-only-token");
  expect(decryptToken(result.encryptedToken)).toBe("synthetic-seed-only-token");
  expect(result.expiresAt).toBeGreaterThan(Date.now() + 3_500_000);
  expect(result).not.toHaveProperty("refreshToken");
});

it("rejects a mismatched state through the actual loopback handler before contacting Google or writing a token", async () => {
  const localFetch = globalThis.fetch;
  const providerFetch = vi.fn(() => {
    throw new Error("Provider calls must not happen");
  });
  vi.stubGlobal("fetch", providerFetch);
  let ready!: () => void;
  const listening = new Promise<void>((resolve) => {
    ready = resolve;
  });
  vi.spyOn(console, "info").mockImplementation(() => ready());
  const result = authorizeSeedWriter({
    clientId: "synthetic-writer",
    clientSecret: "synthetic-secret",
    readerClientId: "synthetic-reader",
    mailbox: "lender@example.test",
  }).then(
    () => "unexpected-success",
    () => "rejected",
  );
  await Promise.race([
    listening,
    result.then(() => {
      throw new Error("Local listener did not start");
    }),
  ]);
  const start = await localFetch(SEED_START, { redirect: "manual" });
  const cookie = start.headers.get("set-cookie")!.split(";")[0];
  const callback = await localFetch(
    `${SEED_CALLBACK}?state=incorrect&code=synthetic`,
    { redirect: "manual", headers: { Cookie: cookie } },
  );
  const done = await localFetch(
    new URL(callback.headers.get("location")!, SEED_START),
  );
  expect(await result).toBe("rejected");
  expect(start.status).toBe(302);
  expect(callback.status).toBe(303);
  expect(new URL(done.url).pathname).toBe("/seed/done");
  expect(done.status).toBe(400);
  expect(await done.text()).not.toContain("synthetic-secret");
  expect(providerFetch).not.toHaveBeenCalled();
});

describe("additive expanded seed contracts", () => {
  it("preserves the original plan and digest while validating the exact expanded manifest", () => {
    const base = createSeedPlan(),
      expanded = createExpandedSeedPlan();
    expect(seedPlanDigest(base)).toBe(
      "cc1ef0ff6f9c58ae201d55f2917a9bb097b581c6c86e3c2680759ef89630a75d",
    );
    expect(expanded.contacts.slice(0, 7)).toEqual(base.contacts);
    expect(expanded.messages.slice(0, 9)).toEqual(base.messages);
    expect(expanded.messages).toHaveLength(59);
    expect(new Set(expanded.messages.map(seedThreadKey)).size).toBe(21);
    expect(() => assertSeedPlan(expanded)).not.toThrow();
    expanded.messages[10].text += "tampered";
    expect(() => assertSeedPlan(expanded)).toThrow("SEED_PLAN_CHANGED");
  });
  it("verifies the base read-only, expands and replays without creating duplicates or changing original IDs", async () => {
    const h = seedHarness();
    await h.writer.apply("true", seedPlanDigest(h.plan));
    const original = structuredClone(h.state),
      expanded = createExpandedSeedPlan();
    h.api.mockClear();
    const next = await h.writer.prepareExpansion(seedPlanDigest(expanded));
    expect(
      h.api.mock.calls.every(
        (call) =>
          call[1] === "GET" ||
          call[2] === "/oauth/v2/private-apps/get/access-token-info",
      ),
    ).toBe(true);
    assertPreservedSeedState(original, next, h.plan);
    const writer = new SeedWriter(
      h.api,
      expanded,
      h.target,
      next,
      async () => {},
    );
    const receipt = await writer.apply("true", seedPlanDigest(expanded));
    expect(receipt.threads).toHaveLength(21);
    expect(receipt.threads.flatMap((t) => t.messages)).toHaveLength(59);
    expect(Object.keys(next.contacts)).toHaveLength(20);
    expect(Object.keys(next.companies)).toHaveLength(20);
    expect(Object.keys(next.deals)).toHaveLength(8);
    assertPreservedSeedState(original, next, h.plan);
    h.api.mockClear();
    expect(await writer.apply("true", seedPlanDigest(expanded))).toEqual(
      receipt,
    );
    expect(
      h.api.mock.calls.some(
        (call) =>
          call[1] === "POST" &&
          call[2] !== "/oauth/v2/private-apps/get/access-token-info",
      ),
    ).toBe(false);
    assertPreservedSeedState(original, next, h.plan);
  });
  it("rejects crossed thread membership even when all aggregate and per-contact counts match", async () => {
    const h = seedHarness();
    await h.writer.apply("true", seedPlanDigest(h.plan));
    const expanded = createExpandedSeedPlan();
    const next = await h.writer.prepareExpansion(seedPlanDigest(expanded));
    const writer = new SeedWriter(
      h.api,
      expanded,
      h.target,
      next,
      async () => {},
    );
    await writer.apply("true", seedPlanDigest(expanded));
    const first = next.messages["alder-acquisition-2"];
    const second = next.messages["alder-renovation-2"];
    [first.threadId, second.threadId] = [second.threadId, first.threadId];
    h.messages[first.id].threadId = first.threadId;
    h.messages[second.id].threadId = second.threadId;
    expect(
      new Set(Object.values(next.messages).map((m) => m.threadId)).size,
    ).toBe(21);
    await expect(writer.verify()).rejects.toThrow(
      "SEED_THREAD_GROUPING_FAILED",
    );
  });
  it("rejects expansion approval and incomplete original data before migration", async () => {
    const h = seedHarness();
    await expect(h.writer.prepareExpansion("wrong")).rejects.toThrow(
      "SEED_EXPANSION_APPROVAL_REQUIRED",
    );
    expect(h.api).not.toHaveBeenCalled();
    await expect(
      h.writer.prepareExpansion(seedPlanDigest(createExpandedSeedPlan())),
    ).rejects.toThrow("SEED_DATASET_INCOMPLETE");
  });
  it("rejects changed original IDs and unknown original associations", async () => {
    const h = seedHarness();
    await h.writer.apply("true", seedPlanDigest(h.plan));
    const original = structuredClone(h.state);
    const next = await h.writer.prepareExpansion(
      seedPlanDigest(createExpandedSeedPlan()),
    );
    next.contacts.cedar = "99999";
    expect(() => assertPreservedSeedState(original, next, h.plan)).toThrow(
      "SEED_EXPANSION_ORIGINAL_ID_CHANGED",
    );
    const api = h.api.getMockImplementation()!;
    h.api.mockImplementation(async (...args) => {
      if (
        args[0] === "hubspot" &&
        args[1] === "GET" &&
        args[2].includes("/associations/")
      )
        return { results: [{ toObjectId: "99999" }] };
      return api(...args);
    });
    await expect(
      h.writer.prepareExpansion(seedPlanDigest(createExpandedSeedPlan())),
    ).rejects.toThrow("SEED_ASSOCIATION_MISMATCH");
  });
  it("retains the uncertain-write stop on an interrupted additive create", async () => {
    const h = seedHarness();
    await h.writer.apply("true", seedPlanDigest(h.plan));
    const expanded = createExpandedSeedPlan();
    const next = await h.writer.prepareExpansion(seedPlanDigest(expanded));
    const api = h.api.getMockImplementation()!;
    h.api.mockImplementation(async (...args) => {
      if (args[1] === "POST" && args[2].startsWith("/crm/v3/objects/"))
        throw new SeedError("SYNTHETIC_CONNECTION_INTERRUPTED");
      return api(...args);
    });
    const writer = new SeedWriter(
      h.api,
      expanded,
      h.target,
      next,
      async () => {},
    );
    await expect(
      writer.apply("true", seedPlanDigest(expanded)),
    ).rejects.toThrow("SYNTHETIC_CONNECTION_INTERRUPTED");
    expect(next.pending).toBe("companies:alder");
    h.api.mockClear();
    await expect(
      writer.apply("true", seedPlanDigest(expanded)),
    ).rejects.toThrow("SEED_UNCERTAIN_WRITE_INSPECTION_REQUIRED");
    expect(h.api).not.toHaveBeenCalled();
  });
});
