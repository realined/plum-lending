import { touchWorker, workerStatus } from "@/server/worker-status";
import { randomBytes, randomUUID } from "node:crypto";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { executeSegment } from "@/domain/executor";
import { assumptions, DEFAULT_QUERY, parseDemo } from "@/domain/segment";
import {
  DemoCRM,
  DemoEmail,
  DEMO_LENDER,
  type DemoScenario,
} from "@/providers/demo";
import { createDatabase, type Database } from "@/server/database";
import {
  claimJob,
  completeJob,
  enqueue,
  failJob,
  getJob,
  getRows,
  heartbeat,
  purgeLocalData,
} from "@/server/repository";
import { workOnce } from "@/server/worker";

const spec = parseDemo(DEFAULT_QUERY);
let database: Database;

async function seedInterpretation() {
  const id = randomUUID();
  await database.query(
    "INSERT INTO segment_requests(id,query,spec,assumptions,source) VALUES($1,$2,$3,$4,$5)",
    [
      id,
      DEFAULT_QUERY,
      JSON.stringify(spec),
      JSON.stringify(assumptions(spec)),
      "demo",
    ],
  );
  return id;
}
async function queue(scenario: DemoScenario = "standard") {
  return enqueue(await seedInterpretation(), "demo", scenario, database);
}
async function standardResult() {
  const crm = await new DemoCRM().snapshot();
  const result = await executeSegment(spec, crm, new DemoEmail(), [
    DEMO_LENDER,
  ]);
  return { crm, result };
}
async function entityCounts() {
  const [counts] = await database.query<Record<string, number>>(`SELECT
    (SELECT count(*)::int FROM contacts) AS contacts,
    (SELECT count(*)::int FROM contact_identities) AS identities,
    (SELECT count(*)::int FROM companies) AS companies,
    (SELECT count(*)::int FROM contact_companies) AS contact_companies,
    (SELECT count(*)::int FROM deals) AS deals,
    (SELECT count(*)::int FROM contact_deals) AS contact_deals,
    (SELECT count(*)::int FROM threads) AS threads,
    (SELECT count(*)::int FROM messages) AS messages,
    (SELECT count(*)::int FROM participants) AS participants`);
  return counts;
}
const noEntities = {
  contacts: 0,
  identities: 0,
  companies: 0,
  contact_companies: 0,
  deals: 0,
  contact_deals: 0,
  threads: 0,
  messages: 0,
  participants: 0,
};
const canonicalStandard = {
  contacts: 8,
  identities: 8,
  companies: 8,
  contact_companies: 8,
  deals: 2,
  contact_deals: 2,
  threads: 4,
  messages: 11,
  participants: 22,
};

beforeAll(async () => {
  database = await createDatabase(":memory:");
}, 30_000);
beforeEach(async () => {
  vi.stubEnv("APP_MODE", "demo");
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  await database.transaction(purgeLocalData);
  await database.query("DELETE FROM connections");
  await database.query("DELETE FROM worker_heartbeats");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
afterAll(async () => {
  await database?.close();
});

describe("durable demo worker execution", () => {
  it("persists a complete export with matching counts, canonical entities, and full thread context", async () => {
    const id = await queue();
    expect(await workOnce(database)).toBe(true);
    const job = await getJob(id, database);
    expect(job).toMatchObject({
      status: "succeeded",
      stage: "Export ready",
      progress: 100,
      attempts: 1,
      lease_owner: null,
      error: null,
      failures: [],
      counts: {
        contacts: 3,
        threads: 4,
        messages: 11,
        excluded: 5,
        failures: 0,
        scannedContacts: 8,
      },
    });
    const rows = await getRows(id, 100, 0, database);
    expect(rows).toHaveLength(4);
    expect(
      new Set(rows.map((row) => `${row.contactId}:${row.threadId}`)),
    ).toEqual(new Set(["c1:t1", "c1:t9", "c2:t2", "c3:t3"]));
    const fullThread = rows.find((row) => row.threadId === "t1")!;
    expect(
      fullThread.raw.messages.map((message) => message.providerMessageId),
    ).toEqual(["m1", "m2", "m3", "m4"]);
    expect(fullThread.qualifyingMessageIds).toEqual(["m2"]);
    expect(fullThread.lastActivity).toBe("2026-08-03T16:45:00.000Z");
    expect(fullThread.raw.messages[1].attachments[0].filename).toBe(
      "Juniper-property-overview.pdf",
    );
    expect(await entityCounts()).toEqual(canonicalStandard);
    const messages = await database.query<{ id: string; position: number }>(
      "SELECT id,position FROM messages WHERE thread_id=$1 ORDER BY position",
      ["demo:t1"],
    );
    expect(messages).toEqual([
      { id: "demo:m1", position: 0 },
      { id: "demo:m2", position: 1 },
      { id: "demo:m3", position: 2 },
      { id: "demo:m4", position: 3 },
    ]);
    const sync = await database.query<{ status: string; completed: boolean }>(
      "SELECT status,completed_at IS NOT NULL AS completed FROM sync_jobs WHERE export_job_id=$1",
      [id],
    );
    expect(sync).toEqual([{ status: "succeeded", completed: true }]);
    expect(await workOnce(database)).toBe(false);
  });
  it("persists a partial export and the unavailable thread without implying full success", async () => {
    const id = await queue("partial");
    await workOnce(database);
    expect(await getJob(id, database)).toMatchObject({
      status: "partial",
      stage: "Export ready with gaps",
      progress: 100,
      error: null,
      counts: {
        contacts: 2,
        threads: 3,
        messages: 8,
        excluded: 6,
        failures: 1,
        scannedContacts: 8,
      },
      failures: [
        { scope: "thread", code: "THREAD_UNAVAILABLE", reference: "t3" },
      ],
    });
    const rows = await getRows(id, 100, 0, database);
    expect(rows.map((row) => row.threadId).sort()).toEqual(["t1", "t2", "t9"]);
    expect(await entityCounts()).toEqual({
      ...canonicalStandard,
      threads: 3,
      messages: 8,
      participants: 16,
    });
    expect(
      await database.query(
        "SELECT status FROM sync_jobs WHERE export_job_id=$1",
        [id],
      ),
    ).toEqual([{ status: "partial" }]);
  });
  it("distinguishes a successful empty result from an upstream outage", async () => {
    const emptyId = await queue("empty");
    await workOnce(database);
    expect(await getJob(emptyId, database)).toMatchObject({
      status: "succeeded",
      progress: 100,
      error: null,
      counts: {
        contacts: 0,
        threads: 0,
        messages: 0,
        excluded: 8,
        failures: 0,
        scannedContacts: 8,
      },
      failures: [],
    });
    expect(await getRows(emptyId, 100, 0, database)).toEqual([]);
    const outageId = await queue("outage");
    await workOnce(database);
    expect(await getJob(outageId, database)).toMatchObject({
      status: "failed",
      stage: "Run failed",
      lease_owner: null,
      counts: {
        contacts: 0,
        threads: 0,
        messages: 0,
        excluded: 0,
        failures: 0,
        scannedContacts: 0,
      },
    });
    expect((await getJob(outageId, database))?.error).toContain(
      "No complete export was published",
    );
    expect(await getRows(outageId, 100, 0, database)).toEqual([]);
    expect(
      await database.query(
        "SELECT status FROM sync_jobs WHERE export_job_id=$1",
        [outageId],
      ),
    ).toEqual([{ status: "failed" }]);
  });
  it("returns one durable job for repeated enqueue of the same interpretation", async () => {
    const interpretation = await seedInterpretation();
    const ids = await Promise.all(
      Array.from({ length: 4 }, () =>
        enqueue(interpretation, "demo", "standard", database),
      ),
    );
    expect(new Set(ids).size).toBe(1);
    await workOnce(database);
    expect(await enqueue(interpretation, "demo", "partial", database)).toBe(
      ids[0],
    );
    expect(await getJob(ids[0], database)).toMatchObject({
      status: "succeeded",
      scenario: "standard",
      attempts: 1,
    });
    expect(
      await database.query("SELECT count(*)::int AS count FROM export_jobs"),
    ).toEqual([{ count: 1 }]);
    expect(await getRows(ids[0], 100, 0, database)).toHaveLength(4);
    await expect(
      enqueue("nonexistent-interpretation", "demo", "standard", database),
    ).rejects.toThrow("INTERPRETATION_NOT_FOUND");
  });
  it("ingests repeated exports without duplicating canonical messages, identities, participants, or relationships", async () => {
    const first = await queue();
    await workOnce(database);
    const before = await entityCounts();
    const second = await queue();
    await workOnce(database);
    expect(await entityCounts()).toEqual(before);
    expect(before).toEqual(canonicalStandard);
    expect(await getRows(second, 100, 0, database)).toEqual(
      await getRows(first, 100, 0, database),
    );
    expect(
      await database.query("SELECT count(*)::int AS count FROM export_results"),
    ).toEqual([{ count: 8 }]);
    expect(
      await database.query(
        "SELECT count(*)::int AS count FROM sync_jobs WHERE status='succeeded'",
      ),
    ).toEqual([{ count: 2 }]);
  });
  it("paginates stored export rows without dropping or duplicating contact/thread pairs", async () => {
    const id = await queue();
    await workOnce(database);
    const all = await getRows(id, 100, 0, database);
    const pages = [
      ...(await getRows(id, 2, 0, database)),
      ...(await getRows(id, 2, 2, database)),
    ];
    expect(pages).toEqual(all);
    expect(await getRows(id, 2, 4, database)).toEqual([]);
  });
});

describe("durable claims and lease fencing", () => {
  it("claims and exhausts only jobs belonging to the worker's configured mode", async () => {
    const liveId = await enqueue(
      await seedInterpretation(),
      "live",
      "standard",
      database,
    );
    const expiredLiveId = await enqueue(
      await seedInterpretation(),
      "live",
      "standard",
      database,
    );
    await database.query(
      "UPDATE export_jobs SET status='running',attempts=3,lease_owner='synthetic-live-owner',lease_until=now()-interval '1 second' WHERE id=$1",
      [expiredLiveId],
    );
    const demoId = await queue();
    expect((await claimJob(database))?.job.id).toBe(demoId);
    expect(await claimJob(database)).toBeNull();
    expect(await getJob(liveId, database)).toMatchObject({
      status: "queued",
      attempts: 0,
    });
    expect(await getJob(expiredLiveId, database)).toMatchObject({
      status: "running",
      attempts: 3,
    });
    vi.stubEnv("APP_MODE", "live");
    vi.stubEnv("APP_URL", "https://plum.example.test");
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://synthetic:synthetic@database.example.test/plum_test",
    );
    vi.stubEnv("ADMIN_PASSWORD", randomBytes(24).toString("base64url"));
    vi.stubEnv("SESSION_SECRET", randomBytes(32).toString("base64url"));
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", randomBytes(32).toString("base64"));
    expect((await claimJob(database))?.job.id).toBe(liveId);
    expect(await getJob(expiredLiveId, database)).toMatchObject({
      status: "failed",
      attempts: 3,
    });
    expect(await getJob(demoId, database)).toMatchObject({
      status: "running",
      attempts: 1,
    });
  });
  it("grants one active owner and permits heartbeat only for that owner", async () => {
    const id = await queue();
    const claims = await Promise.all([claimJob(database), claimJob(database)]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    const claim = claims.find((value) => value !== null)!;
    expect(claim.job).toMatchObject({
      id,
      status: "running",
      attempts: 1,
      lease_owner: claim.owner,
    });
    expect(
      await heartbeat(database, id, "stale-owner", "Wrong stage", 80),
    ).toBe(false);
    expect(
      await heartbeat(
        database,
        id,
        claim.owner,
        "Retrieved synthetic records",
        50,
      ),
    ).toBe(true);
    expect(await getJob(id, database)).toMatchObject({
      stage: "Retrieved synthetic records",
      progress: 50,
      attempts: 1,
    });
  });
  it("recovers an expired lease and fences expired and replaced owners from publishing", async () => {
    const id = await queue();
    const first = (await claimJob(database))!;
    const { crm, result } = await standardResult();
    await database.query(
      "UPDATE export_jobs SET lease_until=now()-interval '1 second' WHERE id=$1",
      [id],
    );
    expect(await heartbeat(database, id, first.owner)).toBe(false);
    expect(
      await completeJob(database, first.job, first.owner, crm, result),
    ).toBe(false);
    expect(await entityCounts()).toEqual(noEntities);
    const recovered = (await claimJob(database))!;
    expect(recovered.owner).not.toBe(first.owner);
    expect(recovered.job).toMatchObject({ id, attempts: 2, status: "running" });
    expect(
      await completeJob(database, first.job, first.owner, crm, result),
    ).toBe(false);
    await failJob(database, id, first.owner);
    expect(await getJob(id, database)).toMatchObject({
      status: "running",
      lease_owner: recovered.owner,
    });
    expect(
      await completeJob(database, recovered.job, recovered.owner, crm, result),
    ).toBe(true);
    expect(await getJob(id, database)).toMatchObject({
      status: "succeeded",
      attempts: 2,
      lease_owner: null,
    });
    expect(await getRows(id, 100, 0, database)).toHaveLength(4);
    expect(
      await completeJob(database, recovered.job, recovered.owner, crm, result),
    ).toBe(false);
  });
  it("fails a repeatedly abandoned job after the third claim and never republishes it", async () => {
    const id = await queue();
    for (let attempt = 1; attempt <= 3; attempt++) {
      const claim = await claimJob(database);
      expect(claim?.job.attempts).toBe(attempt);
      await database.query(
        "INSERT INTO sync_jobs(id,export_job_id,status) VALUES($1,$2,'running')",
        [randomUUID(), id],
      );
      await database.query(
        "UPDATE export_jobs SET lease_until=now()-interval '1 second' WHERE id=$1",
        [id],
      );
    }
    expect(await claimJob(database)).toBeNull();
    expect(await getJob(id, database)).toMatchObject({
      status: "failed",
      stage: "Retry limit reached",
      attempts: 3,
      lease_owner: null,
    });
    expect(await getRows(id, 100, 0, database)).toEqual([]);
    expect(await entityCounts()).toEqual(noEntities);
    expect(
      await database.query(
        "SELECT status,completed_at IS NOT NULL AS completed FROM sync_jobs WHERE export_job_id=$1",
        [id],
      ),
    ).toEqual(
      Array.from({ length: 3 }, () => ({ status: "failed", completed: true })),
    );
  });
});

describe("transactional publication and purge", () => {
  it("rolls back an interrupted database transaction", async () => {
    await expect(
      database.transaction(async (tx) => {
        await tx.query("INSERT INTO companies(id,name,data) VALUES($1,$2,$3)", [
          "synthetic-rollback",
          "Synthetic Rollback",
          "{}",
        ]);
        throw new Error("Synthetic process interruption");
      }),
    ).rejects.toThrow("Synthetic process interruption");
    expect(await database.query("SELECT id FROM companies")).toEqual([]);
  });
  it("rolls back all canonical and export writes when publication fails midway", async () => {
    const id = await queue();
    const claim = (await claimJob(database))!;
    const { crm, result } = await standardResult();
    const invalidResult = structuredClone(result);
    invalidResult.rows[1].raw.messages[0].timestamp =
      "invalid-database-timestamp";
    await expect(
      completeJob(database, claim.job, claim.owner, crm, invalidResult),
    ).rejects.toThrow();
    expect(await entityCounts()).toEqual(noEntities);
    expect(await getRows(id, 100, 0, database)).toEqual([]);
    expect(await getJob(id, database)).toMatchObject({
      status: "running",
      lease_owner: claim.owner,
      progress: 0,
    });
    expect(
      await completeJob(database, claim.job, claim.owner, crm, result),
    ).toBe(true);
    expect(await entityCounts()).toEqual(canonicalStandard);
  });
  it("purges durable results and invalidates an already running worker before it can restore data", async () => {
    const completedId = await queue();
    await workOnce(database);
    await database.query(
      "INSERT INTO connections(id,provider,status,encrypted_token,mailbox,last_sync,cursor) VALUES($1,$2,$3,$4,$5,now(),$6)",
      [
        "synthetic-connection",
        "gmail",
        "connected",
        "synthetic-encrypted-placeholder",
        DEMO_LENDER,
        '{"historyId":"100"}',
      ],
    );
    const runningId = await queue();
    const staleClaim = (await claimJob(database))!;
    const { crm, result } = await standardResult();
    await database.transaction(purgeLocalData);
    expect(await getJob(completedId, database)).toBeNull();
    expect(await getJob(runningId, database)).toBeNull();
    expect(await heartbeat(database, runningId, staleClaim.owner)).toBe(false);
    expect(
      await completeJob(
        database,
        staleClaim.job,
        staleClaim.owner,
        crm,
        result,
      ),
    ).toBe(false);
    await failJob(database, runningId, staleClaim.owner);
    expect(await entityCounts()).toEqual(noEntities);
    expect(
      await database.query("SELECT count(*)::int AS count FROM export_results"),
    ).toEqual([{ count: 0 }]);
    expect(
      await database.query("SELECT count(*)::int AS count FROM sync_jobs"),
    ).toEqual([{ count: 0 }]);
    expect(
      await database.query(
        "SELECT last_sync,cursor FROM connections WHERE id=$1",
        ["synthetic-connection"],
      ),
    ).toEqual([{ last_sync: null, cursor: null }]);
    expect(await workOnce(database)).toBe(false);
  });
});

describe("worker readiness", () => {
  it("distinguishes unseen, recent, stale and wrong-mode heartbeats", async () => {
    expect(await workerStatus(database, "demo")).toEqual({
      state: "unseen",
      lastSeen: null,
    });
    await touchWorker(database, "demo");
    expect(await workerStatus(database, "demo")).toMatchObject({
      state: "ready",
    });
    expect(await workerStatus(database, "live")).toMatchObject({
      state: "unseen",
    });
    await database.query(
      "UPDATE worker_heartbeats SET last_seen=now()-interval '46 seconds'",
    );
    expect(await workerStatus(database, "demo")).toMatchObject({
      state: "stale",
    });
    await touchWorker(database, "demo");
    expect(await workerStatus(database, "demo")).toMatchObject({
      state: "ready",
    });
  });
  it("records a heartbeat even when the worker has no job to claim", async () => {
    expect(await workOnce(database)).toBe(false);
    expect(await workerStatus(database, "demo")).toMatchObject({
      state: "ready",
    });
  });
});
