import { open } from "node:fs/promises";
import { z } from "zod";
import { DataBoundaryError } from "@/domain/data-boundary";
import { parseGmailSeedPolicy } from "@/providers/gmail-seed-policy";

export function gmailAccessConfig() {
  const parsed = z
    .object({
      scope: z.enum(["seed-only", "mailbox"]),
      mailbox: z.email(),
      manifestPath: z.string().min(1),
    })
    .safeParse({
      scope: process.env.GMAIL_DATA_SCOPE ?? "seed-only",
      mailbox: process.env.GMAIL_EXPECTED_MAILBOX?.trim().toLowerCase(),
      manifestPath:
        process.env.GMAIL_SEED_MANIFEST_PATH ?? ".data/live-seed/manifest.json",
    });
  if (!parsed.success) throw new DataBoundaryError();
  return parsed.data;
}

export function assertExpectedMailbox(mailbox: string) {
  if (mailbox.trim().toLowerCase() !== gmailAccessConfig().mailbox)
    throw new DataBoundaryError();
}

export async function loadGmailSeedPolicy() {
  const config = gmailAccessConfig();
  if (config.scope === "mailbox") return undefined;
  try {
    const file = await open(config.manifestPath, "r");
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size > 1_000_000)
        throw new DataBoundaryError();
      const policy = parseGmailSeedPolicy(
        JSON.parse(await file.readFile("utf8")),
      );
      assertExpectedMailbox(policy.mailbox);
      return policy;
    } finally {
      await file.close();
    }
  } catch {
    // Never include file contents, addresses, parser errors or local paths in public failures.
    throw new DataBoundaryError();
  }
}
