import assert from "node:assert/strict";
import { DemoCRM, DemoEmail, DEMO_LENDER } from "../src/providers/demo";
import { db } from "../src/server/database";
import { workOnce } from "../src/server/worker";

// A test-only composition root: never switch off production mode isolation to run fixtures.
const url = new URL(
  process.env.PLUM_TEST_DATABASE_URL ?? "https://missing.invalid",
);
assert(
  ["postgres:", "postgresql:"].includes(url.protocol) &&
    ["localhost", "127.0.0.1"].includes(url.hostname) &&
    /^\/plum_ci(?:_\w+)?$/.test(url.pathname) &&
    process.env.DATABASE_URL === url.href,
);
globalThis.fetch = async () => {
  throw new Error(
    "External HTTP is forbidden in the PostgreSQL fixture worker.",
  );
};
const database = await db();
try {
  assert(
    await workOnce(database, async () => ({
      email: new DemoEmail(),
      crm: new DemoCRM(),
      lenders: [DEMO_LENDER],
    })),
  );
} finally {
  await database.close();
}
