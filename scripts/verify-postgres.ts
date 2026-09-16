import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { createDatabase } from "../src/server/database";
import { DEFAULT_QUERY, assumptions, parseDemo } from "../src/domain/segment";
import { enqueue, saveSegment } from "../src/server/repository";
import { signSession } from "../src/server/auth";

// Explicit opt-in; only an isolated local CI database may be used. Never run against owner data.
const url = new URL(
  process.env.PLUM_TEST_DATABASE_URL ?? "https://missing.invalid",
);
assert(
  ["postgres:", "postgresql:"].includes(url.protocol) &&
    ["localhost", "127.0.0.1"].includes(url.hostname) &&
    /^\/plum_ci(?:_\w+)?$/.test(url.pathname),
  "Set PLUM_TEST_DATABASE_URL to an isolated localhost plum_ci database.",
);
const base = "http://localhost:3200";
Object.assign(process.env, {
  APP_MODE: "live",
  APP_URL: base,
  DATABASE_URL: url.href,
  EMBEDDED_WORKER: "false",
  ADMIN_PASSWORD: randomBytes(24).toString("base64url"),
  SESSION_SECRET: randomBytes(32).toString("base64url"),
  TOKEN_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  GOOGLE_CLIENT_ID: "",
  GOOGLE_CLIENT_SECRET: "",
  GOOGLE_REDIRECT_URI: "",
  HUBSPOT_PRIVATE_APP_TOKEN: "",
  OPENAI_API_KEY: "",
  LENDER_ALIASES: "",
});
const children: ChildProcess[] = [];
const launch = (file: string, args: string[]) => {
  const child = spawn(process.execPath, [file, ...args], {
    env: process.env,
    stdio: "ignore",
  });
  children.push(child);
  return child;
};
async function eventually(check: () => Promise<boolean>) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    try {
      if (await check()) return;
    } catch {
      /* Wait for the independent processes to initialize. */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Native PostgreSQL web/worker check timed out.");
}
let database: Awaited<ReturnType<typeof createDatabase>> | undefined;
try {
  // Two simultaneous startups exercise the advisory migration lock.
  const databases = await Promise.all([
    createDatabase(url.href),
    createDatabase(url.href),
  ]);
  database = databases[0];
  await databases[1].close();
  (globalThis as unknown as { plumDB: Promise<typeof database> }).plumDB =
    Promise.resolve(database);
  const spec = parseDemo(DEFAULT_QUERY);
  const segment = await saveSegment(
    DEFAULT_QUERY,
    spec,
    assumptions(spec),
    "synthetic PostgreSQL acceptance",
  );
  // Explicit demo job inside the native DB: real process/database boundaries, synthetic provider data.
  const id = await enqueue(segment.id, "demo", "standard", database);
  launch("node_modules/next/dist/bin/next", [
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3200",
  ]);
  launch("node_modules/tsx/dist/cli.mjs", ["scripts/worker.ts"]);
  const headers = { cookie: `plum_session=${signSession()}` };
  await eventually(async () => {
    const response = await fetch(`${base}/api/jobs/${id}`, { headers });
    if (!response.ok) return false;
    const body = await response.json();
    return body.job.status === "succeeded" && body.totalRows === 4;
  });
  const response = await fetch(`${base}/api/jobs/${id}`, { headers });
  const body = await response.json();
  assert.deepEqual(body.job.counts, {
    contacts: 3,
    threads: 4,
    messages: 11,
    excluded: 5,
    failures: 0,
    scannedContacts: 8,
  });
  assert.equal(body.rows.length, 4);
  const csv = await fetch(`${base}/api/jobs/${id}/csv`, { headers });
  assert.equal(csv.status, 200);
  const text = await csv.text();
  assert(
    text.includes('"Raw Communication Data"') &&
      text.includes("Our timing has moved to Q4"),
  );
  const status = await (await fetch(`${base}/api/status`, { headers })).json();
  assert.equal(status.workerMode, "external");
  assert.equal(status.worker.state, "ready");
  assert.equal((await fetch(`${base}/api/status`)).status, 401);
  assert.equal(
    (
      await database.query(
        "SELECT version FROM schema_migrations ORDER BY version",
      )
    ).length,
    2,
  );
  console.info(
    "Native PostgreSQL: concurrent migrations, separate web/worker, authentication, 4 CSV rows and full thread context passed (synthetic providers only).",
  );
} finally {
  await Promise.all(
    children.map(async (child) => {
      if (child.exitCode !== null) return;
      const stopped = new Promise<void>((resolve) =>
        child.once("exit", () => resolve()),
      );
      child.kill("SIGTERM");
      const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
      timer.unref();
      await stopped;
      clearTimeout(timer);
    }),
  );
  await database?.close();
}
