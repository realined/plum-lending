import {
  createSeedPlan,
  createExpandedSeedPlan,
  previewSeedPlan,
} from "../src/seed/plan";

// Intentionally no .env loading, provider imports, database or live-write mode.
try {
  const args = process.argv.slice(2);
  if (
    args[0] !== "--dry-run" ||
    args.length > 2 ||
    (args[1] && args[1] !== "--expanded")
  )
    throw new Error();
  console.info(
    previewSeedPlan(
      args[1] === "--expanded" ? createExpandedSeedPlan() : createSeedPlan(),
    ),
  );
} catch {
  console.error(
    "Only the offline --dry-run proposal is available. No live operation was performed.",
  );
  process.exitCode = 1;
}
