import { randomUUID } from "node:crypto";
import { DemoCRM, DemoEmail, DEMO_LENDER } from "@/providers/demo";
import { executeSegment } from "@/domain/executor";
import { segmentSchema } from "@/domain/segment";
import { db, type Database } from "./database";
import { claimJob, completeJob, failJob, heartbeat } from "./repository";
import { config } from "./config";
import { touchWorker } from "./worker-status";
import { safeRunError, type RunStage } from "./job-errors";
import { liveProviders } from "./connections";
export async function workOnce(database?: Database) {
  const d = database ?? (await db());
  const mode = config().mode;
  await touchWorker(d, mode);
  const claim = await claimJob(d);
  if (!claim) return false;
  const { job, owner } = claim;
  let lost = false;
  let stage: RunStage = "connections";
  const timer = setInterval(() => {
    void touchWorker(d, mode)
      .then(() => heartbeat(d, job.id, owner))
      .then((ok) => {
        if (!ok) lost = true;
      })
      .catch(() => {
        lost = true;
      });
  }, 20000);
  timer.unref();
  try {
    const spec = segmentSchema.parse(job.spec);
    const providers =
      job.mode === "demo"
        ? {
            email: new DemoEmail(job.scenario),
            crm: new DemoCRM(),
            lenders: [DEMO_LENDER],
          }
        : await liveProviders();
    await d.query(
      "INSERT INTO sync_jobs(id,export_job_id,status) VALUES($1,$2,'running')",
      [randomUUID(), job.id],
    );
    stage = "hubspot";
    const crm = await providers.crm.snapshot();
    stage = "gmail";
    if (
      lost ||
      !(await heartbeat(
        d,
        job.id,
        owner,
        "Retrieving complete email threads",
        30,
      ))
    )
      throw new Error("LEASE_LOST");
    const result = await executeSegment(
      spec,
      crm,
      providers.email,
      providers.lenders,
      async (done, total) => {
        if (
          lost ||
          !(await heartbeat(
            d,
            job.id,
            owner,
            `Normalizing threads · ${done} of ${total}`,
            30 + Math.round((done / Math.max(total, 1)) * 60),
          ))
        )
          throw new Error("LEASE_LOST");
      },
    );
    if (lost) throw new Error("LEASE_LOST");
    stage = "storage";
    const published = await completeJob(d, job, owner, crm, result);
    console.info(
      JSON.stringify({
        event: published ? "export.completed" : "export.lease_lost",
        jobId: job.id,
        counts: result.counts,
      }),
    );
  } catch (error) {
    await failJob(d, job.id, owner, safeRunError(error, stage));
    console.warn(JSON.stringify({ event: "export.failed", jobId: job.id }));
  } finally {
    clearInterval(timer);
  }
  return true;
}
const state = globalThis as unknown as {
  plumWorker?: NodeJS.Timeout;
  plumWorkerBusy?: boolean;
};
export function startWorker() {
  if (state.plumWorker) return;
  state.plumWorker = setInterval(() => {
    if (state.plumWorkerBusy) return;
    state.plumWorkerBusy = true;
    void workOnce()
      .catch(() => {
        console.warn(JSON.stringify({ event: "worker.poll_failed" }));
      })
      .finally(() => {
        state.plumWorkerBusy = false;
      });
  }, 1000);
  state.plumWorker.unref();
}
