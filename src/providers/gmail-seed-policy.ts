import { z } from "zod";
import { DataBoundaryError } from "@/domain/data-boundary";

const providerId = z.string().regex(/^[a-f0-9]{8,64}$/);
const schema = z
  .object({
    version: z.literal(1),
    mailbox: z.email(),
    namespace: z.string().regex(/^[a-z][a-z0-9-]{7,63}$/),
    labelId: z
      .string()
      .regex(/^Label_[A-Za-z0-9_-]+$/)
      .max(128),
    threads: z
      .array(
        z
          .object({
            id: providerId,
            messages: z
              .array(
                z
                  .object({
                    id: providerId,
                    rfcMessageId: z.string().max(254),
                  })
                  .strict(),
              )
              .min(1)
              .max(100),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();

export type GmailSeedPolicy = z.infer<typeof schema>;

// The seeder will write this private receipt using IDs returned by successful insertions.
// An arbitrary label/subject is not evidence that a message belongs to the test dataset.
export function parseGmailSeedPolicy(input: unknown): GmailSeedPolicy {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new DataBoundaryError();
  const policy = parsed.data;
  const threadIds = new Set<string>();
  const messageIds = new Set<string>();
  const rfcIds = new Set<string>();
  for (const thread of policy.threads) {
    if (threadIds.has(thread.id)) throw new DataBoundaryError();
    threadIds.add(thread.id);
    for (const message of thread.messages) {
      if (
        messageIds.has(message.id) ||
        rfcIds.has(message.rfcMessageId) ||
        !new RegExp(`^<${policy.namespace}\\.[a-z0-9-]+@example\\.test>$`).test(
          message.rfcMessageId,
        )
      )
        throw new DataBoundaryError();
      messageIds.add(message.id);
      rfcIds.add(message.rfcMessageId);
    }
  }
  policy.mailbox = policy.mailbox.toLowerCase();
  return policy;
}
