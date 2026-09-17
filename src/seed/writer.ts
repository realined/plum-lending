import { z } from "zod";
import {
  parseGmailSeedPolicy,
  type GmailSeedPolicy,
} from "@/providers/gmail-seed-policy";
import { assertSeedPlan, seedPlanDigest, type SeedPlan } from "./plan";
import { renderSeedMessage } from "./mime";
import { SeedError } from "./private-files";
import type { SeedAPI } from "./transport";

const id = z.string().regex(/^\d+$/);
const gmailId = z.string().regex(/^[a-f0-9]{8,64}$/);
const object = z.object({
  id,
  properties: z.record(z.string(), z.string().nullable()),
});
const page = z.object({
  results: z.array(object),
  paging: z
    .object({
      next: z.object({ after: z.union([z.string(), z.number()]) }).optional(),
    })
    .optional(),
});
export const stateSchema = z
  .object({
    version: z.literal(1),
    namespace: z.string(),
    digest: z.string(),
    mailbox: z.email(),
    portalId: z.string().regex(/^\d+$/),
    labelId: z
      .string()
      .regex(/^Label_[A-Za-z0-9_-]+$/)
      .optional(),
    contacts: z.record(z.string(), id),
    companies: z.record(z.string(), id),
    deals: z.record(z.string(), id),
    messages: z.record(
      z.string(),
      z.object({ id: gmailId, threadId: gmailId }),
    ),
    pending: z.string().optional(),
    cleanupStarted: z.boolean().optional(),
    cleaned: z.boolean().optional(),
  })
  .strict();
export type SeedState = z.infer<typeof stateSchema>;
export type SeedTarget = {
  mailbox: string;
  portalId: string;
  hubspotToken: string;
  sponsorProperty: string;
};
export const WRITER_SCOPES = [
  "crm.objects.contacts.read",
  "crm.objects.companies.read",
  "crm.objects.deals.read",
  "crm.schemas.contacts.read",
  "crm.schemas.deals.read",
  "crm.objects.contacts.write",
  "crm.objects.companies.write",
  "crm.objects.deals.write",
];
export function newSeedState(plan: SeedPlan, target: SeedTarget): SeedState {
  return stateSchema.parse({
    version: 1,
    namespace: plan.namespace,
    digest: seedPlanDigest(plan),
    mailbox: target.mailbox,
    portalId: target.portalId,
    contacts: {},
    companies: {},
    deals: {},
    messages: {},
  });
}
export class SeedWriter {
  constructor(
    private api: SeedAPI,
    private plan: SeedPlan,
    private target: SeedTarget,
    private state: SeedState,
    private save: (state: SeedState) => Promise<void>,
  ) {
    assertSeedPlan(plan);
    stateSchema.parse(state);
    if (
      state.digest !== seedPlanDigest(plan) ||
      state.namespace !== plan.namespace ||
      state.mailbox !== target.mailbox ||
      state.portalId !== target.portalId ||
      !/^[a-zA-Z0-9_]+$/.test(target.sponsorProperty)
    )
      throw new SeedError("SEED_TARGET_OR_PLAN_CHANGED");
    const keys = new Set(plan.contacts.map((c) => c.key));
    if (
      [
        ...Object.keys(state.contacts),
        ...Object.keys(state.companies),
        ...Object.keys(state.deals),
      ].some((key) => !keys.has(key)) ||
      Object.keys(state.messages).some(
        (key) => !plan.messages.some((m) => m.key === key),
      )
    )
      throw new SeedError("SEED_STATE_INVALID");
  }
  private async identities() {
    const profile = z
      .object({ emailAddress: z.email() })
      .parse(await this.api("gmail", "GET", "/profile?fields=emailAddress"));
    if (profile.emailAddress.toLowerCase() !== this.target.mailbox)
      throw new SeedError("SEED_GMAIL_ACCOUNT_MISMATCH");
    const info = z
      .object({
        hubId: z.union([z.string(), z.number()]),
        scopes: z.array(z.string()),
      })
      .parse(
        await this.api(
          "hubspot",
          "POST",
          "/oauth/v2/private-apps/get/access-token-info",
          { tokenKey: this.target.hubspotToken },
        ),
      );
    if (String(info.hubId) !== this.target.portalId)
      throw new SeedError("SEED_HUBSPOT_ACCOUNT_MISMATCH");
    if (!WRITER_SCOPES.every((scope) => info.scopes.includes(scope)))
      throw new SeedError("SEED_WRITER_SCOPES_REQUIRED");
  }
  private async stages() {
    const data = z
      .object({
        results: z.array(
          z.object({
            id: z.string(),
            stages: z.array(
              z.object({
                id: z.string(),
                displayOrder: z.number(),
                metadata: z.object({
                  isClosed: z.union([z.string(), z.boolean()]),
                  probability: z.union([z.string(), z.number()]),
                }),
              }),
            ),
          }),
        ),
      })
      .parse(await this.api("hubspot", "GET", "/crm/v3/pipelines/deals"));
    if (data.results.length !== 1)
      throw new SeedError("SEED_PIPELINE_SELECTION_REQUIRED");
    const pipeline = data.results[0];
    const stage = (kind: "open" | "won" | "lost") => {
      const matches = pipeline.stages
        .filter((s) =>
          kind === "open"
            ? String(s.metadata.isClosed) === "false"
            : String(s.metadata.isClosed) === "true" &&
              Number(s.metadata.probability) === (kind === "won" ? 1 : 0),
        )
        .sort((a, b) => a.displayOrder - b.displayOrder);
      if (!matches.length || (kind !== "open" && matches.length !== 1))
        throw new SeedError("SEED_PIPELINE_SELECTION_REQUIRED");
      return matches[0].id;
    };
    return {
      pipeline: pipeline.id,
      open: stage("open"),
      won: stage("won"),
      lost: stage("lost"),
    };
  }
  private properties(
    type: "contacts" | "companies" | "deals",
    key: string,
    stages: Awaited<ReturnType<SeedWriter["stages"]>>,
  ): Record<string, string> {
    const contact = this.plan.contacts.find((c) => c.key === key)!;
    if (type === "contacts")
      return {
        email: contact.email,
        firstname: contact.firstName,
        lastname: contact.lastName,
        [this.target.sponsorProperty]: contact.role,
      };
    if (type === "companies")
      return { name: contact.company, domain: contact.domain };
    if (!contact.deal) throw new SeedError("SEED_UNPLANNED_DEAL");
    return {
      dealname: `[${this.plan.namespace}] ${key} - ${contact.deal}`,
      pipeline: stages.pipeline,
      dealstage: stages[contact.deal],
    };
  }
  private matches(
    actual: Record<string, string | null>,
    expected: Record<string, string | undefined>,
  ) {
    return Object.entries(expected).every(
      ([key, value]) => actual[key] === value,
    );
  }
  private async verifyMessage(key: string) {
    const saved = this.state.messages[key],
      planned = this.plan.messages.find((m) => m.key === key)!;
    const params = new URLSearchParams({
      format: "metadata",
      fields: "id,threadId,internalDate,payload(headers)",
    });
    for (const header of ["Message-ID", "Subject", "X-Plum-Poc-Namespace"])
      params.append("metadataHeaders", header);
    const message = z
      .object({
        id: gmailId,
        threadId: gmailId,
        internalDate: z.string(),
        payload: z.object({
          headers: z.array(z.object({ name: z.string(), value: z.string() })),
        }),
      })
      .parse(await this.api("gmail", "GET", `/messages/${saved.id}?${params}`));
    const exactHeader = (name: string, value: string) => {
      const found = message.payload.headers.filter(
        (h) => h.name.toLowerCase() === name,
      );
      return found.length === 1 && found[0].value === value;
    };
    if (
      message.id !== saved.id ||
      message.threadId !== saved.threadId ||
      Number(message.internalDate) !== Date.parse(planned.date) ||
      !exactHeader("message-id", planned.rfcMessageId) ||
      !exactHeader("subject", planned.subject) ||
      !exactHeader("x-plum-poc-namespace", this.plan.namespace)
    )
      throw new SeedError("SEED_MESSAGE_CHANGED");
  }
  async preflight() {
    if (this.state.pending)
      throw new SeedError("SEED_UNCERTAIN_WRITE_INSPECTION_REQUIRED");
    if (this.state.cleaned || this.state.cleanupStarted)
      throw new SeedError("SEED_CLEANUP_ALREADY_STARTED");
    await this.identities();
    const property = z
      .object({ name: z.string(), type: z.string(), fieldType: z.string() })
      .parse(
        await this.api(
          "hubspot",
          "GET",
          `/crm/v3/properties/contacts/${this.target.sponsorProperty}`,
        ),
      );
    if (
      property.name !== this.target.sponsorProperty ||
      property.type !== "string" ||
      property.fieldType !== "text"
    )
      throw new SeedError("SEED_SPONSOR_SCHEMA_MISMATCH");
    const stages = await this.stages();
    for (const type of ["contacts", "companies", "deals"] as const) {
      let after: string | undefined;
      const seen = new Set<string>();
      const found = new Set<string>();
      const fields = Object.keys(this.properties(type, "cedar", stages));
      do {
        const params = new URLSearchParams({
          limit: "100",
          properties: fields.join(","),
          archived: "false",
        });
        if (after) params.set("after", after);
        const data = page.parse(
          await this.api("hubspot", "GET", `/crm/v3/objects/${type}?${params}`),
        );
        for (const item of data.results) {
          const key = Object.entries(this.state[type]).find(
            ([, savedId]) => savedId === item.id,
          )?.[0];
          if (
            !key ||
            !this.matches(item.properties, this.properties(type, key, stages))
          )
            throw new SeedError("SEED_UNTRACKED_OR_CHANGED_CRM_RECORD");
          found.add(item.id);
        }
        after = data.paging?.next ? String(data.paging.next.after) : undefined;
        if (after && (seen.has(after) || seen.size >= 10))
          throw new SeedError("SEED_PAGINATION_LIMIT");
        if (after) seen.add(after);
      } while (after);
      if (found.size !== Object.keys(this.state[type]).length)
        throw new SeedError("SEED_TRACKED_CRM_RECORD_MISSING");
    }
    const labels = z
      .object({
        labels: z.array(z.object({ id: z.string(), name: z.string() })),
      })
      .parse(await this.api("gmail", "GET", "/labels?fields=labels(id,name)"));
    const matching = labels.labels.filter(
      (label) => label.name === this.plan.namespace,
    );
    if (
      this.state.labelId
        ? matching.length !== 1 || matching[0].id !== this.state.labelId
        : matching.length !== 0
    )
      throw new SeedError("SEED_LABEL_COLLISION_OR_MISSING");
    if (this.state.labelId) {
      let token: string | undefined;
      const found = new Set<string>(),
        seen = new Set<string>();
      do {
        const params = new URLSearchParams({
          labelIds: this.state.labelId,
          includeSpamTrash: "true",
          maxResults: "100",
          fields: "messages(id,threadId),nextPageToken",
        });
        if (token) params.set("pageToken", token);
        const data = z
          .object({
            messages: z
              .array(z.object({ id: gmailId, threadId: gmailId }))
              .optional(),
            nextPageToken: z.string().optional(),
          })
          .parse(await this.api("gmail", "GET", `/messages?${params}`));
        for (const message of data.messages ?? []) {
          if (
            !Object.values(this.state.messages).some(
              (saved) =>
                saved.id === message.id && saved.threadId === message.threadId,
            )
          )
            throw new SeedError("SEED_UNTRACKED_LABELED_MESSAGE");
          found.add(message.id);
        }
        token = data.nextPageToken;
        if (token && (seen.has(token) || seen.size >= 10))
          throw new SeedError("SEED_PAGINATION_LIMIT");
        if (token) seen.add(token);
      } while (token);
      if (found.size !== Object.keys(this.state.messages).length)
        throw new SeedError("SEED_TRACKED_MESSAGE_MISSING");
    }
    for (const key of Object.keys(this.state.messages))
      await this.verifyMessage(key);
    return stages;
  }
  private async create<T>(
    key: string,
    operation: () => Promise<T>,
    record: (value: T) => void,
  ) {
    this.state.pending = key;
    await this.save(this.state);
    const result = await operation(); // Never retry an uncertain create automatically.
    record(result);
    delete this.state.pending;
    await this.save(this.state);
  }
  async apply(
    enabled: string | undefined,
    approvedDigest: string,
  ): Promise<GmailSeedPolicy> {
    if (enabled !== "true" || approvedDigest !== seedPlanDigest(this.plan))
      throw new SeedError("SEED_EXPLICIT_APPROVAL_REQUIRED");
    const stages = await this.preflight();
    for (const contact of this.plan.contacts) {
      for (const type of ["companies", "contacts", "deals"] as const) {
        if (
          (type === "deals" && !contact.deal) ||
          this.state[type][contact.key]
        )
          continue;
        await this.create(
          `${type}:${contact.key}`,
          async () =>
            object.parse(
              await this.api("hubspot", "POST", `/crm/v3/objects/${type}`, {
                properties: this.properties(type, contact.key, stages),
              }),
            ),
          (item) => {
            this.state[type][contact.key] = item.id;
          },
        );
      }
      for (const type of ["companies", "deals"] as const) {
        const targetId = this.state[type][contact.key];
        if (targetId)
          await this.api(
            "hubspot",
            "PUT",
            `/crm/v4/objects/contacts/${this.state.contacts[contact.key]}/associations/default/${type}/${targetId}`,
          );
      }
    }
    if (!this.state.labelId)
      await this.create(
        "gmail:label",
        async () =>
          z.object({ id: z.string().regex(/^Label_[A-Za-z0-9_-]+$/) }).parse(
            await this.api("gmail", "POST", "/labels", {
              name: this.plan.namespace,
              labelListVisibility: "labelShow",
              messageListVisibility: "show",
            }),
          ),
        (label) => {
          this.state.labelId = label.id;
        },
      );
    for (const message of this.plan.messages) {
      if (this.state.messages[message.key]) continue;
      const prior = this.plan.messages.find(
        (m) => m.caseKey === message.caseKey && this.state.messages[m.key],
      );
      const threadId = prior
        ? this.state.messages[prior.key].threadId
        : undefined;
      await this.create(
        `gmail:${message.key}`,
        async () =>
          z.object({ id: gmailId, threadId: gmailId }).parse(
            await this.api(
              "gmail",
              "POST",
              "/messages?internalDateSource=dateHeader",
              {
                raw: Buffer.from(
                  renderSeedMessage(this.plan, message, this.target.mailbox),
                ).toString("base64url"),
                labelIds: [this.state.labelId],
                ...(threadId ? { threadId } : {}),
              },
            ),
          ),
        (item) => {
          this.state.messages[message.key] = item;
        },
      );
      if (threadId && this.state.messages[message.key].threadId !== threadId)
        throw new SeedError("SEED_THREAD_GROUPING_FAILED");
    }
    await this.preflight();
    for (const contact of this.plan.contacts) {
      const ids = new Set(
        this.plan.messages
          .filter((m) => m.caseKey === contact.key)
          .map((m) => this.state.messages[m.key].threadId),
      );
      if (ids.size !== (contact.key === "meadow" ? 0 : 1))
        throw new SeedError("SEED_THREAD_GROUPING_FAILED");
      for (const type of ["companies", "deals"] as const) {
        const data = z
          .object({
            results: z.array(
              z.object({ toObjectId: z.union([z.string(), z.number()]) }),
            ),
            paging: z.unknown().optional(),
          })
          .parse(
            await this.api(
              "hubspot",
              "GET",
              `/crm/v4/objects/contacts/${this.state.contacts[contact.key]}/associations/${type}?limit=500`,
            ),
          );
        const expected = this.state[type][contact.key];
        if (
          data.paging ||
          data.results.length !== (expected ? 1 : 0) ||
          (expected && String(data.results[0].toObjectId) !== expected)
        )
          throw new SeedError("SEED_ASSOCIATION_MISMATCH");
      }
    }
    const threads = [
      ...new Set(Object.values(this.state.messages).map((m) => m.threadId)),
    ].map((threadId) => ({
      id: threadId,
      messages: this.plan.messages
        .filter((m) => this.state.messages[m.key].threadId === threadId)
        .map((m) => ({
          id: this.state.messages[m.key].id,
          rfcMessageId: m.rfcMessageId,
        })),
    }));
    if (threads.length !== this.plan.counts.threads)
      throw new SeedError("SEED_THREAD_GROUPING_FAILED");
    for (const thread of threads) {
      const data = z
        .object({
          id: gmailId,
          messages: z.array(z.object({ id: gmailId, threadId: gmailId })),
        })
        .parse(
          await this.api(
            "gmail",
            "GET",
            `/threads/${thread.id}?format=minimal&fields=id,messages(id,threadId)`,
          ),
        );
      if (
        data.id !== thread.id ||
        data.messages.length !== thread.messages.length ||
        new Set(data.messages.map((m) => m.id)).size !==
          thread.messages.length ||
        data.messages.some(
          (m) =>
            m.threadId !== thread.id ||
            !thread.messages.some((expected) => expected.id === m.id),
        )
      )
        throw new SeedError("SEED_MIXED_THREAD");
    }
    return parseGmailSeedPolicy({
      version: 1,
      namespace: this.plan.namespace,
      mailbox: this.target.mailbox,
      labelId: this.state.labelId,
      threads,
    });
  }
  async cleanup(
    enabled: string | undefined,
    approvedDigest: string,
    disableReceipt: () => Promise<void>,
  ) {
    if (
      enabled !== "true" ||
      approvedDigest !== this.state.digest ||
      this.state.pending
    )
      throw new SeedError("SEED_EXPLICIT_APPROVAL_REQUIRED");
    if (this.state.cleaned) return;
    await this.identities();
    const stages = await this.stages();
    await disableReceipt();
    this.state.cleanupStarted = true;
    await this.save(this.state);
    if (this.state.labelId) {
      const labels = z
        .object({
          labels: z.array(z.object({ id: z.string(), name: z.string() })),
        })
        .parse(
          await this.api("gmail", "GET", "/labels?fields=labels(id,name)"),
        );
      const label = labels.labels.find(
        (item) => item.id === this.state.labelId,
      );
      if (label && label.name !== this.plan.namespace)
        throw new SeedError("SEED_LABEL_CHANGED");
      if (label) {
        const data = z
          .object({
            messages: z.array(z.object({ id: gmailId })).optional(),
            nextPageToken: z.string().optional(),
          })
          .parse(
            await this.api(
              "gmail",
              "GET",
              `/messages?labelIds=${this.state.labelId}&includeSpamTrash=true&maxResults=100&fields=messages(id),nextPageToken`,
            ),
          );
        if (
          data.nextPageToken ||
          (data.messages ?? []).some(
            (m) =>
              !Object.values(this.state.messages).some(
                (saved) => saved.id === m.id,
              ),
          )
        )
          throw new SeedError("SEED_UNTRACKED_LABELED_MESSAGE");
        await this.api("gmail", "DELETE", `/labels/${this.state.labelId}`);
      }
    }
    for (const type of ["deals", "contacts", "companies"] as const) {
      for (const [key, savedId] of Object.entries(this.state[type])) {
        try {
          const props = this.properties(type, key, stages);
          const item = object.parse(
            await this.api(
              "hubspot",
              "GET",
              `/crm/v3/objects/${type}/${savedId}?properties=${Object.keys(props).join(",")}`,
            ),
          );
          if (item.id !== savedId || !this.matches(item.properties, props))
            throw new SeedError("SEED_RECORD_CHANGED_CLEANUP_BLOCKED");
          await this.api(
            "hubspot",
            "DELETE",
            `/crm/v3/objects/${type}/${savedId}`,
          );
        } catch (error) {
          if (!(error instanceof SeedError) || error.code !== "SEED_NOT_FOUND")
            throw error;
        }
      }
    }
    this.state.cleaned = true;
    await this.save(this.state);
  }
}
