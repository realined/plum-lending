import { config } from "./config";
import { randomUUID } from "node:crypto";
import { connections } from "@/db/schema";
import {
  emptyCounts,
  type CRMSnapshot,
  type ExecutionResult,
  type ExportRow,
  type Counts,
  type Failure,
} from "@/domain/models";
import { type SegmentSpec } from "@/domain/segment";
import { db, type Database, type QueryDB } from "./database";
export type Job = {
  id: string;
  segment_id: string;
  status: "queued" | "running" | "succeeded" | "partial" | "failed";
  stage: string;
  progress: number;
  attempts: number;
  lease_owner: string | null;
  mode: "demo" | "live";
  scenario: "standard" | "partial" | "empty" | "outage";
  counts: Counts;
  failures: Failure[];
  exclusions: Record<string, number>;
  error: string | null;
  created_at: string;
  updated_at: string;
  spec: SegmentSpec;
  query: string;
};
export async function connectionList() {
  return (await (await db()).orm.select().from(connections)).map((c) => ({
    id: c.id,
    provider: c.provider,
    status: c.status,
    mailbox: c.mailbox,
    lastSync: c.lastSync,
  }));
}
export async function saveSegment(
  query: string,
  spec: SegmentSpec,
  assumptions: string[],
  source: string,
) {
  const id = randomUUID();
  await (
    await db()
  ).query(
    "INSERT INTO segment_requests(id,query,spec,assumptions,source) VALUES($1,$2,$3,$4,$5)",
    [id, query, JSON.stringify(spec), JSON.stringify(assumptions), source],
  );
  return { id, query, spec, assumptions, source };
}
export async function enqueue(
  segmentId: string,
  mode: string,
  scenario: string,
  database?: Database,
) {
  const d = database ?? (await db());
  const id = randomUUID();
  const rows = await d.query<{ id: string }>(
    "INSERT INTO export_jobs(id,segment_id,status,stage,mode,scenario,counts,failures,exclusions) SELECT $1,id,'queued','Waiting for worker',$3,$4,$5,'[]','{}' FROM segment_requests WHERE id=$2 ON CONFLICT(segment_id) DO UPDATE SET segment_id=EXCLUDED.segment_id RETURNING id",
    [id, segmentId, mode, scenario, JSON.stringify(emptyCounts())],
  );
  if (!rows[0]) throw new Error("INTERPRETATION_NOT_FOUND");
  return rows[0].id;
}
export async function getJob(id: string, database?: Database) {
  const rows = await (database ?? (await db())).query<Job>(
    "SELECT j.*,s.spec,s.query FROM export_jobs j JOIN segment_requests s ON s.id=j.segment_id WHERE j.id=$1",
    [id],
  );
  return rows[0] ?? null;
}
export async function listJobs() {
  return (await db()).query<Job>(
    "SELECT j.*,s.spec,s.query FROM export_jobs j JOIN segment_requests s ON s.id=j.segment_id ORDER BY j.created_at DESC LIMIT 12",
  );
}
export async function getRows(
  id: string,
  limit = 100,
  offset = 0,
  database?: Database,
) {
  return (
    await (database ?? (await db())).query<{ data: ExportRow }>(
      "SELECT data FROM export_results WHERE job_id=$1 ORDER BY data->>'accountName',contact_id,thread_id LIMIT $2 OFFSET $3",
      [id, limit, offset],
    )
  ).map((r) => r.data);
}
export async function claimJob(database: Database) {
  await database.transaction(async (tx) => {
    const expired = await tx.query<{ id: string }>(
      "UPDATE export_jobs SET status='failed',stage='Retry limit reached',error='Worker recovery limit reached. Interpret and run again.',lease_owner=NULL,lease_until=NULL WHERE status='running' AND lease_until<now() AND attempts>=3 AND mode=$1 RETURNING id",
      [config().mode],
    );
    for (const job of expired)
      await tx.query(
        "UPDATE sync_jobs SET status='failed',completed_at=now() WHERE export_job_id=$1 AND status='running'",
        [job.id],
      );
  });
  const owner = randomUUID();
  const claimed = await database.query<{ id: string }>(
    "UPDATE export_jobs SET status='running',stage='Loading CRM records',attempts=attempts+1,lease_owner=$1,lease_until=now()+interval '90 seconds',updated_at=now() WHERE id=(SELECT id FROM export_jobs WHERE mode=$2 AND (status='queued' OR (status='running' AND lease_until<now() AND attempts<3)) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id",
    [owner, config().mode],
  );
  if (!claimed[0]) return null;
  return { job: (await getJob(claimed[0].id, database))!, owner };
}
export async function heartbeat(
  d: Database,
  id: string,
  owner: string,
  stage?: string,
  progress?: number,
) {
  const rows = await d.query(
    "UPDATE export_jobs SET lease_until=now()+interval '90 seconds',updated_at=now(),stage=COALESCE($3,stage),progress=COALESCE($4,progress) WHERE id=$1 AND lease_owner=$2 AND status='running' AND lease_until>now() RETURNING id",
    [id, owner, stage ?? null, progress ?? null],
  );
  return rows.length === 1;
}
async function persistCanonical(
  tx: QueryDB,
  crm: CRMSnapshot,
  result: ExecutionResult,
  namespace: string,
) {
  const key = (id: string) => `${namespace}:${id}`;
  for (const c of crm.companies)
    await tx.query(
      "INSERT INTO companies(id,name,data) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,data=EXCLUDED.data",
      [key(c.id), c.name, JSON.stringify(c)],
    );
  for (const d of crm.deals)
    await tx.query(
      "INSERT INTO deals(id,status,data) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET status=EXCLUDED.status,data=EXCLUDED.data",
      [key(d.id), d.status, JSON.stringify(d)],
    );
  for (const c of crm.contacts) {
    const id = key(c.id);
    await tx.query(
      "INSERT INTO contacts(id,first_name,last_name,role,data) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET first_name=EXCLUDED.first_name,last_name=EXCLUDED.last_name,role=EXCLUDED.role,data=EXCLUDED.data",
      [id, c.firstName, c.lastName, c.role, JSON.stringify(c)],
    );
    for (const table of [
      "contact_identities",
      "contact_deals",
      "contact_companies",
    ])
      await tx.query(`DELETE FROM ${table} WHERE contact_id=$1`, [id]);
    for (const email of c.emails)
      await tx.query(
        "INSERT INTO contact_identities(contact_id,email) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [id, email.toLowerCase()],
      );
    for (const company of c.companyIds.filter((cid) =>
      crm.companies.some((a) => a.id === cid),
    ))
      await tx.query(
        "INSERT INTO contact_companies(contact_id,company_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [id, key(company)],
      );
    for (const deal of c.dealIds.filter((did) =>
      crm.deals.some((d) => d.id === did),
    ))
      await tx.query(
        "INSERT INTO contact_deals(contact_id,deal_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [id, key(deal)],
      );
  }
  const unique = new Map(result.rows.map((r) => [r.threadId, r.raw]));
  for (const t of unique.values()) {
    const tid = key(t.providerThreadId);
    await tx.query(
      "INSERT INTO threads(id,provider,data) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data",
      [tid, t.provider, JSON.stringify(t)],
    );
    await tx.query("DELETE FROM messages WHERE thread_id=$1", [tid]);
    for (const m of t.messages) {
      const mid = key(m.providerMessageId);
      await tx.query(
        "INSERT INTO messages(id,thread_id,position,timestamp,data) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET thread_id=EXCLUDED.thread_id,position=EXCLUDED.position,timestamp=EXCLUDED.timestamp,data=EXCLUDED.data",
        [mid, tid, m.position, m.timestamp, JSON.stringify(m)],
      );
      for (const [role, people] of Object.entries({
        from: [m.from],
        to: m.to,
        cc: m.cc,
        bcc: m.bcc,
      }))
        for (const p of people)
          await tx.query(
            "INSERT INTO participants(message_id,role,email,name) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
            [mid, role, p.email, p.name],
          );
    }
  }
}
export async function completeJob(
  d: Database,
  job: Job,
  owner: string,
  crm: CRMSnapshot,
  result: ExecutionResult,
) {
  return d.transaction(async (tx) => {
    const locked = await tx.query(
      "SELECT id FROM export_jobs WHERE id=$1 AND lease_owner=$2 AND status='running' AND lease_until>now() FOR UPDATE",
      [job.id, owner],
    );
    if (!locked.length) return false;
    await persistCanonical(tx, crm, result, job.mode);
    await tx.query("DELETE FROM export_results WHERE job_id=$1", [job.id]);
    for (const row of result.rows)
      await tx.query(
        "INSERT INTO export_results(job_id,contact_id,thread_id,data) VALUES($1,$2,$3,$4) ON CONFLICT(job_id,contact_id,thread_id) DO UPDATE SET data=EXCLUDED.data",
        [job.id, row.contactId, row.threadId, JSON.stringify(row)],
      );
    await tx.query(
      "UPDATE export_jobs SET status=$3,stage=$4,progress=100,counts=$5,failures=$6,exclusions=$7,error=NULL,lease_owner=NULL,lease_until=NULL,updated_at=now() WHERE id=$1 AND lease_owner=$2",
      [
        job.id,
        owner,
        result.failures.length ? "partial" : "succeeded",
        result.failures.length ? "Export ready with gaps" : "Export ready",
        JSON.stringify(result.counts),
        JSON.stringify(result.failures),
        JSON.stringify(result.exclusions),
      ],
    );
    await tx.query(
      "UPDATE sync_jobs SET status=$2,completed_at=now() WHERE export_job_id=$1",
      [job.id, result.failures.length ? "partial" : "succeeded"],
    );
    if (!result.failures.length)
      await tx.query(
        "UPDATE connections SET last_sync=now() WHERE status='connected'",
      );
    return true;
  });
}
export async function failJob(d: Database, id: string, owner: string) {
  await d.query(
    "UPDATE export_jobs SET status='failed',stage='Run failed',error='A provider or processing step failed. Check connections and try a new run. No complete export was published.',lease_owner=NULL,lease_until=NULL,updated_at=now() WHERE id=$1 AND lease_owner=$2 AND status='running'",
    [id, owner],
  );
  await d.query(
    "UPDATE sync_jobs SET status='failed',completed_at=now() WHERE export_job_id=$1 AND EXISTS(SELECT 1 FROM export_jobs WHERE id=$1 AND status='failed')",
    [id],
  );
}
export async function purgeLocalData(tx: QueryDB) {
  await tx.query("DELETE FROM segment_requests");
  for (const table of ["contacts", "companies", "deals", "threads"])
    await tx.query(`DELETE FROM ${table}`);
  await tx.query("UPDATE connections SET last_sync=NULL,cursor=NULL");
}
