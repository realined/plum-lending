import { z } from "zod";
import type { EmailProvider } from "./contracts";
import type { SegmentSpec } from "@/domain/segment";
import { normalizeGmailThread, gmailThreadSchema } from "@/domain/normalize";
import { fetchJson, ProviderError } from "./http";
const pageSchema = z.object({
  threads: z.array(z.object({ id: z.string() })).optional(),
  nextPageToken: z.string().optional(),
});
const historySchema = z.object({
  historyId: z.string(),
  nextPageToken: z.string().optional(),
  history: z
    .array(
      z.object({
        messagesAdded: z
          .array(
            z.object({
              message: z.object({ id: z.string(), threadId: z.string() }),
            }),
          )
          .optional(),
        messagesDeleted: z
          .array(z.object({ message: z.object({ id: z.string() }) }))
          .optional(),
      }),
    )
    .optional(),
});
const API = "https://gmail.googleapis.com/gmail/v1/users/me";
export class GmailProvider implements EmailProvider {
  readonly name = "gmail" as const;
  constructor(
    private getToken: () => Promise<string>,
    private lenderEmails: string[],
  ) {}
  private async get(path: string) {
    return fetchJson(API + path, {
      headers: { Authorization: `Bearer ${await this.getToken()}` },
    });
  }
  async validateConnection() {
    const p = z
      .object({ emailAddress: z.email(), historyId: z.string() })
      .parse(await this.get("/profile"));
    return { mailbox: p.emailAddress, cursor: p.historyId };
  }
  async *searchThreads(spec: SegmentSpec, senderEmails: string[]) {
    // CRM limits candidate retrieval. Exact eligibility is still checked after full-thread normalization.
    const senders = [
      ...new Set(
        senderEmails.map((email) =>
          z.email().parse(email.trim().toLowerCase()),
        ),
      ),
    ];
    const dates = `after:${Math.floor(Date.parse(spec.startInclusive) / 1000) - 1} before:${Math.ceil(Date.parse(spec.endExclusive) / 1000) + 1}`;
    const batches: string[][] = [];
    for (const sender of senders) {
      // Quote validated addresses: provider search syntax never comes from the NL query.
      const term = `from:"${sender}"`;
      const last = batches.at(-1);
      if (
        !last ||
        last.length >= 20 ||
        last.join(" ").length + term.length > 1200
      )
        batches.push([term]);
      else last.push(term);
    }
    const threadIds = new Set<string>();
    for (const batch of batches) {
      const q = `${dates} {${batch.join(" ")}}`;
      let pageToken: string | undefined;
      const seen = new Set<string>();
      do {
        const params = new URLSearchParams({
          q,
          maxResults: "100",
          includeSpamTrash: "true",
        });
        if (pageToken) params.set("pageToken", pageToken);
        const page = pageSchema.parse(await this.get(`/threads?${params}`));
        for (const t of page.threads ?? []) {
          if (!threadIds.has(t.id)) {
            threadIds.add(t.id);
            yield t.id;
          }
        }
        pageToken = page.nextPageToken;
        if (pageToken && seen.has(pageToken))
          throw new ProviderError("PAGINATION_LOOP");
        if (pageToken) seen.add(pageToken);
      } while (pageToken);
    }
  }
  async getThread(id: string) {
    const thread = gmailThreadSchema.parse(
      await this.get(`/threads/${encodeURIComponent(id)}?format=full`),
    );
    // Gmail can externalize text parts. Fetch only text bodies, never binary attachments.
    const hydrate = async (
      part: (typeof thread.messages)[number]["payload"],
      messageId: string,
    ): Promise<void> => {
      if (
        !part.filename &&
        !/^attachment/i.test(
          part.headers?.find(
            (h) => h.name.toLowerCase() === "content-disposition",
          )?.value ?? "",
        ) &&
        part.body?.attachmentId &&
        !part.body.data &&
        ["text/plain", "text/html"].includes(part.mimeType ?? "")
      ) {
        if ((part.body.size ?? 0) > 3_000_000)
          throw new ProviderError("BODY_LIMIT");
        const body = z
          .object({ data: z.string() })
          .parse(
            await this.get(
              `/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(part.body.attachmentId)}`,
            ),
          );
        part.body.data = body.data;
      }
      for (const child of part.parts ?? []) await hydrate(child, messageId);
    };
    for (const message of thread.messages)
      await hydrate(message.payload, message.id);
    return normalizeGmailThread(thread, this.lenderEmails);
  }
  async synchronize(cursor: string) {
    const ids = new Set<string>(),
      deleted = new Set<string>();
    let pageToken: string | undefined,
      nextCursor = cursor;
    const seen = new Set<string>();
    try {
      do {
        const p = new URLSearchParams({
          startHistoryId: cursor,
          maxResults: "500",
        });
        if (pageToken) p.set("pageToken", pageToken);
        const page = historySchema.parse(await this.get(`/history?${p}`));
        for (const h of page.history ?? []) {
          for (const m of h.messagesAdded ?? []) ids.add(m.message.threadId);
          for (const m of h.messagesDeleted ?? []) deleted.add(m.message.id);
        }
        nextCursor = page.historyId;
        pageToken = page.nextPageToken;
        if (pageToken && seen.has(pageToken))
          throw new ProviderError("PAGINATION_LOOP");
        if (pageToken) seen.add(pageToken);
      } while (pageToken);
    } catch (e) {
      if (e instanceof ProviderError && e.status === 404)
        return {
          threadIds: [],
          deletedMessageIds: [],
          nextCursor: cursor,
          requiresFullSync: true,
        };
      throw e;
    }
    return {
      threadIds: [...ids],
      deletedMessageIds: [...deleted],
      nextCursor,
      requiresFullSync: false,
    };
  }
}
