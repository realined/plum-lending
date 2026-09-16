import { z } from "zod";

export const DEFAULT_QUERY =
  "Pull all Sponsor contacts who have sent emails to the lender in the last 2 years minus the last 3 months and have not closed a deal in HubSpot.";
export const DEMO_AS_OF = "2026-09-16T12:00:00.000Z";
export const intentSchema = z
  .object({
    supported: z.boolean(),
    role: z.literal("Sponsor"),
    lookbackMonths: z.number().int().min(1).max(60),
    excludeRecentMonths: z.number().int().min(0).max(24),
    direction: z.literal("inbound"),
    dealPolicy: z.literal("no_closed_won"),
    clarification: z.string().max(500).nullable(),
  })
  .strict();
export const segmentSchema = z
  .object({
    version: z.literal(1),
    role: z.literal("Sponsor"),
    direction: z.literal("inbound"),
    dealPolicy: z.literal("no_closed_won"),
    dealScope: z.literal("direct_contact_all_time"),
    asOf: z.iso.datetime(),
    startInclusive: z.iso.datetime(),
    endExclusive: z.iso.datetime(),
    timezone: z.literal("UTC"),
    lookbackMonths: z.number().int().min(1).max(60),
    excludeRecentMonths: z.number().int().min(0).max(24),
  })
  .strict()
  .superRefine((s, ctx) => {
    if (!Number.isFinite(Date.parse(s.asOf))) return;
    if (
      s.excludeRecentMonths >= s.lookbackMonths ||
      s.startInclusive !== subtractMonths(s.asOf, s.lookbackMonths) ||
      s.endExclusive !== subtractMonths(s.asOf, s.excludeRecentMonths)
    )
      ctx.addIssue({
        code: "custom",
        message:
          "The window must match the frozen calendar-month interpretation.",
      });
  });
export type SegmentSpec = z.infer<typeof segmentSchema>;
export type Intent = z.infer<typeof intentSchema>;
export function subtractMonths(iso: string, months: number): string {
  const d = new Date(iso),
    day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - months);
  const last = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString();
}
export function resolveIntent(raw: unknown, asOf: string): SegmentSpec {
  const i = intentSchema.parse(raw);
  if (!i.supported)
    throw new Error(
      "This slice supports Sponsor contacts, inbound email, and no Closed Won deals. Please use the example request.",
    );
  return segmentSchema.parse({
    version: 1,
    role: i.role,
    direction: i.direction,
    dealPolicy: i.dealPolicy,
    dealScope: "direct_contact_all_time",
    asOf,
    timezone: "UTC",
    lookbackMonths: i.lookbackMonths,
    excludeRecentMonths: i.excludeRecentMonths,
    startInclusive: subtractMonths(asOf, i.lookbackMonths),
    endExclusive: subtractMonths(asOf, i.excludeRecentMonths),
  });
}
export function parseDemo(query: string, asOf = DEMO_AS_OF): SegmentSpec {
  const normalized = query
    .toLowerCase()
    .trim()
    .replace(/[.!]$/, "")
    .replace(/\s+/g, " ")
    .replace(/\btwo\b/g, "2")
    .replace(/\bthree\b/g, "3")
    .replace(/\bone\b/g, "1");
  const match = normalized.match(
    /^(?:pull|find|get)(?: all)? sponsor contacts who have sent emails to the lender in the last (\d+) (years?|months?) minus the last (\d+) months? and (?:have not|haven't) closed a deal in hubspot$/,
  );
  if (!match)
    throw new Error(
      "Demo mode supports the example wording with different month/year values. Use live mode for AI interpretation.",
    );
  return resolveIntent(
    {
      supported: true,
      role: "Sponsor",
      lookbackMonths: Number(match[1]) * (match[2].startsWith("year") ? 12 : 1),
      excludeRecentMonths: Number(match[3]),
      direction: "inbound",
      dealPolicy: "no_closed_won",
      clarification: null,
    },
    asOf,
  );
}
export function assumptions(spec: SegmentSpec): string[] {
  return [
    "Sponsor is an exact CRM contact-property match; it is never inferred from email content.",
    "The contact must be the sender, with the lender in To, CC, or BCC.",
    `UTC window: ${spec.startInclusive} inclusive to ${spec.endExclusive} exclusive.`,
    "Exclude any directly associated deal currently Closed Won, across all pipelines and all time. Closed Lost is allowed.",
    "Return the entire accessible thread, including messages outside the matching window. One contact/thread pair per row.",
  ];
}
