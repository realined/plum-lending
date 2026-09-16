import type { EmailProvider } from "@/providers/contracts";
import type { SegmentSpec } from "./segment";
import {
  contactSchema,
  threadSchema,
  emptyCounts,
  type CRMSnapshot,
  type ExecutionResult,
  type Thread,
} from "./models";
import { normalizeEmail } from "./identity";
export async function executeSegment(
  spec: SegmentSpec,
  crm: CRMSnapshot,
  email: EmailProvider,
  lenderEmails: string[],
  onProgress: (done: number, total: number) => Promise<void> = async () => {},
): Promise<ExecutionResult> {
  const result: ExecutionResult = {
    rows: [],
    counts: emptyCounts(),
    failures: [...crm.failures],
    exclusions: {},
  };
  const exclude = (reason: string) => {
    result.counts.excluded++;
    result.exclusions[reason] = (result.exclusions[reason] ?? 0) + 1;
  };
  const deals = new Map(crm.deals.map((d) => [d.id, d])),
    companies = new Map(crm.companies.map((c) => [c.id, c.name]));
  const contacts = [
    ...new Map(
      crm.contacts.map((c) => [c.id, contactSchema.parse(c)]),
    ).values(),
  ];
  result.counts.scannedContacts = contacts.length;
  const eligible = contacts.filter((c) => {
    if (c.role.trim().toLowerCase() !== spec.role.toLowerCase()) {
      exclude("Not a Sponsor");
      return false;
    }
    if (
      !c.associationsComplete ||
      c.dealIds.some(
        (id) => !deals.has(id) || deals.get(id)?.status === "unknown",
      )
    ) {
      exclude("CRM eligibility could not be verified");
      if (
        !result.failures.some(
          (f) => f.scope === "contact" && f.reference === c.id,
        )
      )
        result.failures.push({
          scope: "contact",
          code: "CRM_INCOMPLETE",
          reference: c.id,
        });
      return false;
    }
    if (c.dealIds.some((id) => deals.get(id)?.status === "won")) {
      exclude("Closed Won deal");
      return false;
    }
    return true;
  });
  if (!eligible.length) {
    result.counts.failures = result.failures.length;
    return result;
  }
  const senderEmails = [
    ...new Set(eligible.flatMap((c) => c.emails.map(normalizeEmail))),
  ];
  const lenders = new Set(lenderEmails.map(normalizeEmail));
  const threadIds = new Set<string>();
  // A search failure invalidates completeness of the whole run; do not report an empty success.
  for await (const id of email.searchThreads(spec, senderEmails))
    threadIds.add(id);
  const threads: Thread[] = [];
  let done = 0;
  for (const id of threadIds) {
    try {
      const t = threadSchema.parse(await email.getThread(id));
      if (t.providerThreadId !== id) throw new Error("ID_MISMATCH");
      threads.push({
        ...t,
        messages: [
          ...new Map(t.messages.map((m) => [m.providerMessageId, m])).values(),
        ],
      });
    } catch {
      result.failures.push({
        scope: "thread",
        code: "THREAD_UNAVAILABLE",
        reference: id,
      });
    }
    await onProgress(++done, threadIds.size);
  }
  const matchedContacts = new Set<string>(),
    matchedThreads = new Set<string>(),
    matchedMessages = new Set<string>();
  for (const c of eligible) {
    const identities = new Set(c.emails.map(normalizeEmail));
    let matched = false;
    for (const t of threads) {
      const qualifying = t.messages.filter(
        (m) =>
          identities.has(normalizeEmail(m.from.email)) &&
          m.direction === "inbound" &&
          [...m.to, ...m.cc, ...m.bcc].some((p) =>
            lenders.has(normalizeEmail(p.email)),
          ) &&
          Date.parse(m.timestamp) >= Date.parse(spec.startInclusive) &&
          Date.parse(m.timestamp) < Date.parse(spec.endExclusive),
      );
      if (!qualifying.length) continue;
      matched = true;
      matchedContacts.add(c.id);
      matchedThreads.add(t.providerThreadId);
      t.messages.forEach((m) => matchedMessages.add(m.providerMessageId));
      const ordered = [...t.messages].sort(
        (a, b) =>
          Date.parse(a.timestamp) - Date.parse(b.timestamp) ||
          a.providerMessageId.localeCompare(b.providerMessageId),
      );
      const canonical = {
        ...t,
        messages: ordered.map((m, position) => ({ ...m, position })),
      };
      result.rows.push({
        contactId: c.id,
        threadId: t.providerThreadId,
        accountName: c.companyIds
          .map((id) => companies.get(id) ?? "Unknown company")
          .join("; "),
        firstName: c.firstName,
        lastName: c.lastName,
        email: normalizeEmail(c.emails[0]),
        lastActivity: ordered.at(-1)!.timestamp,
        subject: t.subject,
        body: canonical.messages
          .map(
            (m) =>
              `[${m.timestamp}] ${m.from.name ? m.from.name + " " : ""}<${m.from.email}> → ${m.to.map((p) => p.email).join(", ")}\nSubject: ${m.subject}\n${m.text}`,
          )
          .join("\n\n────────────\n\n"),
        raw: canonical,
        qualifyingMessageIds: qualifying.map((m) => m.providerMessageId),
      });
    }
    if (!matched) exclude("No qualifying inbound email");
  }
  result.rows.sort(
    (a, b) =>
      a.accountName.localeCompare(b.accountName) ||
      a.email.localeCompare(b.email) ||
      a.threadId.localeCompare(b.threadId),
  );
  result.counts = {
    ...result.counts,
    contacts: matchedContacts.size,
    threads: matchedThreads.size,
    messages: matchedMessages.size,
    failures: result.failures.length,
  };
  return result;
}
