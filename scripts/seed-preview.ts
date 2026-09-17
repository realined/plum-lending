import { createSeedPlan, previewSeedPlan } from "../src/seed/plan";

// Intentionally no .env loading, provider imports, database or live-write mode.
try {
  const args = process.argv.slice(2);
  if (args.length !== 1 || args[0] !== "--dry-run") throw new Error();
  console.info(previewSeedPlan(createSeedPlan()));
} catch {
  console.error(
    "Only the offline --dry-run proposal is available. No live operation was performed.",
  );
  process.exitCode = 1;
}
