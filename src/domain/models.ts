import { z } from "zod";
export const identitySchema = z.object({
  email: z.email(),
  name: z.string().default(""),
});
export type Identity = z.infer<typeof identitySchema>;
export const messageSchema = z.object({
  providerMessageId: z.string().min(1),
  providerThreadId: z.string().min(1),
  subject: z.string(),
  from: identitySchema,
  to: z.array(identitySchema),
  cc: z.array(identitySchema),
  bcc: z.array(identitySchema),
  timestamp: z.iso.datetime(),
  text: z.string(),
  sanitizedHtml: z.string().nullable(),
  direction: z.enum(["inbound", "outbound", "other"]),
  attachments: z.array(
    z.object({
      providerAttachmentId: z.string().nullable(),
      filename: z.string(),
      mimeType: z.string(),
      size: z.number().nonnegative(),
    }),
  ),
  position: z.number().int().nonnegative(),
});
export const threadSchema = z.object({
  provider: z.enum(["gmail", "demo", "outlook"]),
  providerThreadId: z.string().min(1),
  subject: z.string(),
  messages: z.array(messageSchema).min(1),
});
export type Message = z.infer<typeof messageSchema>;
export type Thread = z.infer<typeof threadSchema>;
export const contactSchema = z.object({
  id: z.string().min(1),
  firstName: z.string(),
  lastName: z.string(),
  emails: z.array(z.email()).min(1),
  role: z.string(),
  companyIds: z.array(z.string()),
  dealIds: z.array(z.string()),
  associationsComplete: z.boolean(),
});
export type Contact = z.infer<typeof contactSchema>;
export const companySchema = z.object({ id: z.string(), name: z.string() });
export const dealSchema = z.object({
  id: z.string(),
  name: z.string(),
  stage: z.string(),
  pipeline: z.string(),
  status: z.enum(["open", "won", "lost", "unknown"]),
});
export type Company = z.infer<typeof companySchema>;
export type Deal = z.infer<typeof dealSchema>;
export type Failure = {
  scope: "contact" | "thread" | "provider";
  code: string;
  reference: string;
};
export type CRMSnapshot = {
  contacts: Contact[];
  companies: Company[];
  deals: Deal[];
  failures: Failure[];
  capturedAt: string;
};
export type ExportRow = {
  contactId: string;
  threadId: string;
  accountName: string;
  firstName: string;
  lastName: string;
  email: string;
  lastActivity: string;
  subject: string;
  body: string;
  raw: Thread;
  qualifyingMessageIds: string[];
};
export type Counts = {
  contacts: number;
  threads: number;
  messages: number;
  excluded: number;
  failures: number;
  scannedContacts: number;
};
export type ExecutionResult = {
  rows: ExportRow[];
  counts: Counts;
  failures: Failure[];
  exclusions: Record<string, number>;
};
export const emptyCounts = (): Counts => ({
  contacts: 0,
  threads: 0,
  messages: 0,
  excluded: 0,
  failures: 0,
  scannedContacts: 0,
});
