import { z } from "zod";
import { simpleParser, type AddressObject } from "mailparser";
import sanitizeHtml from "sanitize-html";
import { normalizeEmail } from "./identity";
import {
  threadSchema,
  type Identity,
  type Message,
  type Thread,
} from "./models";
type Part = {
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string; attachmentId?: string; size?: number };
  parts?: Part[];
};
export const partSchema: z.ZodType<Part> = z.lazy(() =>
  z.object({
    mimeType: z.string().optional(),
    filename: z.string().optional(),
    headers: z
      .array(z.object({ name: z.string(), value: z.string() }))
      .optional(),
    body: z
      .object({
        data: z.string().optional(),
        attachmentId: z.string().optional(),
        size: z.number().nonnegative().optional(),
      })
      .optional(),
    parts: z.array(partSchema).optional(),
  }),
);
export const gmailThreadSchema = z.object({
  id: z.string(),
  messages: z
    .array(
      z.object({
        id: z.string(),
        threadId: z.string(),
        internalDate: z.string().regex(/^\d+$/),
        payload: partSchema,
      }),
    )
    .min(1),
});
function addresses(
  value: AddressObject | AddressObject[] | undefined,
): Identity[] {
  const flatten = (entries: AddressObject["value"]): Identity[] =>
    entries.flatMap((entry) =>
      entry.group
        ? flatten(entry.group)
        : entry.address
          ? [{ email: normalizeEmail(entry.address), name: entry.name ?? "" }]
          : [],
    );
  return flatten(
    (Array.isArray(value) ? value : [value]).flatMap((v) => v?.value ?? []),
  );
}
export function cleanHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p",
      "br",
      "div",
      "span",
      "b",
      "strong",
      "i",
      "em",
      "ul",
      "ol",
      "li",
      "blockquote",
      "pre",
      "table",
      "tbody",
      "tr",
      "td",
      "th",
    ],
    allowedAttributes: {},
    disallowedTagsMode: "discard",
    nonTextTags: ["script", "style", "textarea", "option"],
  });
}
export function htmlToText(html: string): string {
  return sanitizeHtml(
    html.replace(/<(?:br|\/p|\/div|\/li|\/tr)\s*\/?>/gi, "\n"),
    {
      allowedTags: [],
      allowedAttributes: {},
      nonTextTags: ["script", "style", "textarea", "option"],
    },
  )
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}
function extract(part: Part): {
  plain: string[];
  html: string[];
  attachments: Message["attachments"];
} {
  const out: {
    plain: string[];
    html: string[];
    attachments: Message["attachments"];
  } = { plain: [], html: [], attachments: [] };
  const disposition =
    part.headers?.find((h) => h.name.toLowerCase() === "content-disposition")
      ?.value ?? "";
  if (part.filename || /^attachment/i.test(disposition)) {
    out.attachments.push({
      providerAttachmentId: part.body?.attachmentId ?? null,
      filename: part.filename ?? "attachment",
      mimeType: part.mimeType ?? "application/octet-stream",
      size: part.body?.size ?? 0,
    });
    return out;
  }
  if (
    part.body?.data &&
    (part.mimeType === "text/plain" || part.mimeType === "text/html")
  ) {
    if (part.body.data.length > 4_000_000) throw new Error("BODY_LIMIT");
    const contentType =
      part.headers?.find((h) => h.name.toLowerCase() === "content-type")
        ?.value ?? "";
    const charset =
      contentType.match(/charset=["']?([^;"'\s]+)/i)?.[1] ?? "utf-8";
    const body = new TextDecoder(charset).decode(
      Buffer.from(part.body.data, "base64url"),
    );
    (part.mimeType === "text/plain" ? out.plain : out.html).push(body);
  }
  for (const child of part.parts ?? []) {
    const data = extract(child);
    out.plain.push(...data.plain);
    out.html.push(...data.html);
    out.attachments.push(...data.attachments);
  }
  return out;
}
export async function normalizeGmailThread(
  input: unknown,
  lenderEmails: string[],
): Promise<Thread> {
  const raw = gmailThreadSchema.parse(input);
  const lenders = new Set(lenderEmails.map(normalizeEmail));
  const messages: Message[] = [];
  for (const m of raw.messages) {
    if (m.threadId !== raw.id) throw new Error("THREAD_ID_MISMATCH");
    const headers = (m.payload.headers ?? [])
      .map(
        (h) =>
          `${h.name.replace(/[\r\n:]/g, "")}: ${h.value.replace(/[\r\n]+/g, " ")}`,
      )
      .join("\r\n");
    const parsed = await simpleParser(headers + "\r\n\r\n", {
      skipHtmlToText: true,
      skipTextToHtml: true,
    });
    const from = addresses(parsed.from)[0];
    if (!from) throw new Error("MISSING_SENDER");
    const to = addresses(parsed.to),
      cc = addresses(parsed.cc),
      bcc = addresses(parsed.bcc),
      content = extract(m.payload);
    const html = content.html.length
      ? cleanHtml(content.html.join("\n"))
      : null;
    messages.push({
      providerMessageId: m.id,
      providerThreadId: m.threadId,
      subject: parsed.subject ?? "(no subject)",
      from,
      to,
      cc,
      bcc,
      timestamp: new Date(Number(m.internalDate)).toISOString(),
      text: content.plain.join("\n").trim() || (html ? htmlToText(html) : ""),
      sanitizedHtml: html,
      direction: lenders.has(from.email)
        ? "outbound"
        : [...to, ...cc, ...bcc].some((a) => lenders.has(a.email))
          ? "inbound"
          : "other",
      attachments: content.attachments,
      position: 0,
    });
  }
  const ordered = [
    ...new Map(messages.map((m) => [m.providerMessageId, m])).values(),
  ]
    .sort(
      (a, b) =>
        a.timestamp.localeCompare(b.timestamp) ||
        a.providerMessageId.localeCompare(b.providerMessageId),
    )
    .map((m, position) => ({ ...m, position }));
  return threadSchema.parse({
    provider: "gmail",
    providerThreadId: raw.id,
    subject: ordered[0].subject,
    messages: ordered,
  });
}
