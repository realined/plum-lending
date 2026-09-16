import { z } from "zod";
import type { CRMProvider } from "./contracts";
import { normalizeEmail } from "@/domain/identity";
import type { Contact, Deal, CRMSnapshot } from "@/domain/models";
import { fetchJson, ProviderError } from "./http";
const objectSchema = z.object({
  id: z.string(),
  properties: z.record(z.string(), z.string().nullable()),
});
const paging = z
  .object({
    next: z.object({ after: z.union([z.string(), z.number()]) }).optional(),
  })
  .optional();
const pageSchema = z.object({ results: z.array(objectSchema), paging });
const assocSchema = z.object({
  results: z.array(z.object({ toObjectId: z.union([z.number(), z.string()]) })),
  paging,
});
const pipelineSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      stages: z.array(
        z.object({
          id: z.string(),
          metadata: z
            .object({
              isClosed: z.union([z.string(), z.boolean()]).optional(),
              probability: z.union([z.string(), z.number()]).optional(),
            })
            .passthrough(),
        }),
      ),
    }),
  ),
});
export class HubSpotProvider implements CRMProvider {
  readonly name = "hubspot" as const;
  constructor(
    private token: string,
    private sponsorProperty = "contact_type",
    private sponsorValue = "Sponsor",
  ) {
    if (!/^[a-zA-Z0-9_]+$/.test(sponsorProperty))
      throw new Error("INVALID_SPONSOR_PROPERTY");
  }
  private async get(path: string) {
    return fetchJson("https://api.hubapi.com" + path, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
  }
  async validateConnection() {
    await this.get(
      `/crm/v3/objects/contacts?limit=1&properties=${this.sponsorProperty}`,
    );
    await this.get(`/crm/v3/properties/contacts/${this.sponsorProperty}`);
    await this.get("/crm/v3/objects/companies?limit=1&properties=name");
    await this.get(
      "/crm/v3/objects/deals?limit=1&properties=dealstage,pipeline",
    );
    await this.get("/crm/v3/pipelines/deals");
  }
  private async all(type: string, properties: string[]) {
    const out: z.infer<typeof objectSchema>[] = [];
    let after: string | undefined;
    const seen = new Set<string>();
    do {
      const p = new URLSearchParams({
        limit: "100",
        properties: properties.join(","),
        archived: "false",
      });
      if (after) p.set("after", after);
      const page = pageSchema.parse(
        await this.get(`/crm/v3/objects/${type}?${p}`),
      );
      out.push(...page.results);
      after = page.paging?.next ? String(page.paging.next.after) : undefined;
      if (after && seen.has(after)) throw new ProviderError("PAGINATION_LOOP");
      if (after) seen.add(after);
    } while (after);
    return [...new Map(out.map((o) => [o.id, o])).values()];
  }
  async searchContacts(): Promise<Contact[]> {
    return (
      await this.all("contacts", [
        "firstname",
        "lastname",
        "email",
        "hs_additional_emails",
        this.sponsorProperty,
      ])
    ).map((o) => {
      const p = o.properties;
      const emails = [
        ...new Set(
          [p.email, ...(p.hs_additional_emails ?? "").split(";")]
            .filter((e): e is string => Boolean(e?.trim()))
            .map(normalizeEmail),
        ),
      ];
      return {
        id: o.id,
        firstName: p.firstname ?? "",
        lastName: p.lastname ?? "",
        emails,
        role:
          (p[this.sponsorProperty] ?? "").toLowerCase() ===
          this.sponsorValue.toLowerCase()
            ? "Sponsor"
            : "Other",
        companyIds: [],
        dealIds: [],
        associationsComplete: false,
      };
    });
  }
  async getCompanies() {
    return (await this.all("companies", ["name"])).map((o) => ({
      id: o.id,
      name: o.properties.name ?? "Unnamed company",
    }));
  }
  async getDeals(): Promise<Deal[]> {
    const pipelines = pipelineSchema.parse(
      await this.get("/crm/v3/pipelines/deals"),
    );
    const stages = new Map<string, Deal["status"]>();
    for (const p of pipelines.results)
      for (const s of p.stages) {
        const closed =
          s.metadata.isClosed === true || s.metadata.isClosed === "true";
        const explicitlyOpen =
          s.metadata.isClosed === false || s.metadata.isClosed === "false";
        const prob =
          s.metadata.probability === undefined
            ? NaN
            : Number(s.metadata.probability);
        stages.set(
          `${p.id}:${s.id}`,
          closed
            ? prob === 1
              ? "won"
              : prob === 0
                ? "lost"
                : "unknown"
            : explicitlyOpen
              ? "open"
              : "unknown",
        );
      }
    return (await this.all("deals", ["dealname", "dealstage", "pipeline"])).map(
      (o) => ({
        id: o.id,
        name: o.properties.dealname ?? "",
        stage: o.properties.dealstage ?? "",
        pipeline: o.properties.pipeline ?? "",
        status:
          stages.get(`${o.properties.pipeline}:${o.properties.dealstage}`) ??
          "unknown",
      }),
    );
  }
  async getAssociations(contactId: string) {
    const read = async (type: string) => {
      const ids = new Set<string>();
      let after: string | undefined;
      const seen = new Set<string>();
      do {
        const p = new URLSearchParams({ limit: "500" });
        if (after) p.set("after", after);
        const page = assocSchema.parse(
          await this.get(
            `/crm/v4/objects/contacts/${encodeURIComponent(contactId)}/associations/${type}?${p}`,
          ),
        );
        page.results.forEach((a) => ids.add(String(a.toObjectId)));
        after = page.paging?.next ? String(page.paging.next.after) : undefined;
        if (after && seen.has(after))
          throw new ProviderError("PAGINATION_LOOP");
        if (after) seen.add(after);
      } while (after);
      return [...ids];
    };
    return {
      companyIds: await read("companies"),
      dealIds: await read("deals"),
    };
  }
  async snapshot(): Promise<CRMSnapshot> {
    // A failed complete object listing must abort; absence of a deal is not proof of eligibility.
    const contacts = await this.searchContacts(),
      companies = await this.getCompanies(),
      deals = await this.getDeals();
    const failures: CRMSnapshot["failures"] = [];
    for (const c of contacts) {
      if (!c.emails.length) {
        failures.push({
          scope: "contact",
          code: "CONTACT_EMAIL_MISSING",
          reference: c.id,
        });
        continue;
      }
      try {
        Object.assign(c, await this.getAssociations(c.id), {
          associationsComplete: true,
        });
      } catch {
        failures.push({
          scope: "contact",
          code: "ASSOCIATIONS_UNAVAILABLE",
          reference: c.id,
        });
      }
    }
    return {
      contacts: contacts.filter((c) => c.emails.length),
      companies,
      deals,
      failures,
      capturedAt: new Date().toISOString(),
    };
  }
}
