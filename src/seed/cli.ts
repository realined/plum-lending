import { access, open, rename } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { decryptToken } from "@/server/crypto";
import { db } from "@/server/database";
import { createSeedPlan, seedPlanDigest } from "./plan";
import { authorizeSeedWriter } from "./oauth";
import {
  exclusiveSeed,
  privateJson,
  writePrivate,
  SEED_DIRECTORY,
  SeedError,
} from "./private-files";
import { newSeedState, SeedWriter, stateSchema } from "./writer";
import { seedTransport } from "./transport";

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "setup" && !args.length) {
    const file = await open(".env.seed", "wx", 0o600);
    try {
      await file.writeFile(
        "# Separate seed credentials only. Never paste values into chat.\nALLOW_DEMO_SEED=false\nSEED_GOOGLE_CLIENT_ID=\nSEED_GOOGLE_CLIENT_SECRET=\nSEED_HUBSPOT_PRIVATE_APP_TOKEN=\n",
      );
    } finally {
      await file.close();
    }
    console.info(
      "Created private .env.seed template. Existing .env and reader credentials are unchanged.",
    );
    return;
  }
  if (
    !["auth", "preflight", "apply", "cleanup"].includes(command) ||
    process.env.ALLOW_DEMO_SEED !== "true" ||
    process.env.APP_MODE !== "live"
  )
    throw new SeedError("SEED_ENABLE_FLAG_REQUIRED");
  const mailbox = z
    .email()
    .parse(process.env.GMAIL_EXPECTED_MAILBOX)
    .toLowerCase();
  if (
    process.env.GMAIL_DATA_SCOPE !== "seed-only" ||
    path.resolve(
      process.env.GMAIL_SEED_MANIFEST_PATH ?? `${SEED_DIRECTORY}/manifest.json`,
    ) !== path.resolve(`${SEED_DIRECTORY}/manifest.json`) ||
    (process.env.HUBSPOT_SPONSOR_VALUE ?? "Sponsor") !== "Sponsor"
  )
    throw new SeedError("SEED_READER_BOUNDARY_CONFIGURATION_REQUIRED");
  const selection = z
    .object({ hubspotPortalId: z.string().regex(/^\d+$/) })
    .parse(await privateJson(`${SEED_DIRECTORY}/account-selection.json`));
  const clientId = process.env.SEED_GOOGLE_CLIENT_ID?.trim() ?? "";
  if (command === "auth") {
    if (args.length) throw new SeedError("SEED_ARGUMENTS_INVALID");
    await exclusiveSeed(() =>
      authorizeSeedWriter({
        clientId,
        clientSecret: process.env.SEED_GOOGLE_CLIENT_SECRET ?? "",
        readerClientId: process.env.GOOGLE_CLIENT_ID ?? "",
        mailbox,
      }),
    );
    console.info(
      "Separate short-lived seed authorization saved. No dataset writes occurred.",
    );
    return;
  }
  const plan = createSeedPlan();
  const digest = args[0]?.startsWith("--approve=")
    ? args[0].slice("--approve=".length)
    : "";
  if (
    command === "preflight"
      ? args.length !== 0
      : args.length !== 1 || digest !== seedPlanDigest(plan)
  )
    throw new SeedError("SEED_EXPLICIT_APPROVAL_REQUIRED");
  const hubspotToken = process.env.SEED_HUBSPOT_PRIVATE_APP_TOKEN?.trim();
  if (
    !hubspotToken ||
    hubspotToken === process.env.HUBSPOT_PRIVATE_APP_TOKEN ||
    !clientId ||
    clientId === process.env.GOOGLE_CLIENT_ID
  )
    throw new SeedError("SEED_SEPARATE_CREDENTIALS_REQUIRED");
  const authorization = z
    .object({
      clientId: z.string(),
      mailbox: z.email(),
      expiresAt: z.number(),
      encryptedToken: z.string(),
    })
    .parse(await privateJson(`${SEED_DIRECTORY}/writer-token.json`));
  if (
    authorization.clientId !== clientId ||
    authorization.mailbox !== mailbox ||
    authorization.expiresAt < Date.now() + 60_000
  )
    throw new SeedError("SEED_REAUTHORIZE_WRITER");
  const target = {
    mailbox,
    portalId: selection.hubspotPortalId,
    hubspotToken,
    sponsorProperty: process.env.HUBSPOT_SPONSOR_PROPERTY ?? "contact_type",
  };
  await exclusiveSeed(async () => {
    const database = await db();
    try {
      if (
        (
          await database.query(
            "SELECT id FROM export_jobs WHERE status IN ('queued','running')",
          )
        ).length
      )
        throw new SeedError("SEED_ACTIVE_EXPORT_BLOCKED");
    } finally {
      await database.close();
    }
    const file = `${SEED_DIRECTORY}/writer-state.json`;
    let state = newSeedState(plan, target);
    try {
      await access(file);
      state = stateSchema.parse(await privateJson(file));
    } catch (error) {
      if (!(
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      ))
        throw error;
    }
    const writer = new SeedWriter(
      seedTransport(decryptToken(authorization.encryptedToken), hubspotToken),
      plan,
      target,
      state,
      (updated) => writePrivate(file, updated),
    );
    if (command === "preflight") {
      await writer.preflight();
      console.info(
        `Read-only seed preflight passed. Planned: 7 contacts, 7 companies, 3 deals, 6 threads, 9 messages. Approval digest: ${seedPlanDigest(plan)}. No dataset writes occurred.`,
      );
    } else if (command === "apply") {
      await writePrivate(file, state);
      const receipt = await writer.apply(process.env.ALLOW_DEMO_SEED, digest);
      await writePrivate(`${SEED_DIRECTORY}/manifest.json`, receipt);
      console.info(
        "Seed verification passed and private insertion receipt saved: 7 contacts, 7 companies, 3 deals, 6 threads, 9 messages. No email was sent.",
      );
    } else {
      await writer.cleanup(process.env.ALLOW_DEMO_SEED, digest, async () => {
        try {
          await rename(
            `${SEED_DIRECTORY}/manifest.json`,
            `${SEED_DIRECTORY}/manifest.disabled.json`,
          );
        } catch (error) {
          if (!(
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "ENOENT"
          ))
            throw error;
        }
      });
      console.info(
        "Recorded CRM objects archived, seed label removed, application receipt disabled. Synthetic Gmail messages remain. Automatic recreation after cleanup is blocked.",
      );
    }
  });
}
main().catch((error: unknown) => {
  console.error(
    error instanceof SeedError
      ? error.code
      : "SEED_FAILED_REVIEW_PRIVATE_SETUP",
  );
  process.exitCode = 1;
});
