import type { QueryDB } from "./database";
export type WorkerStatus = {
  state: "ready" | "stale" | "unseen";
  lastSeen: string | null;
};
export async function touchWorker(d: QueryDB, mode: "demo" | "live") {
  await d.query(
    "INSERT INTO worker_heartbeats(mode,last_seen) VALUES($1,now()) ON CONFLICT(mode) DO UPDATE SET last_seen=excluded.last_seen",
    [mode],
  );
}
export async function workerStatus(
  d: QueryDB,
  mode: "demo" | "live",
): Promise<WorkerStatus> {
  const [row] = await d.query<{ last_seen: string | Date; fresh: boolean }>(
    "SELECT last_seen,last_seen > now() - interval '45 seconds' AS fresh FROM worker_heartbeats WHERE mode=$1",
    [mode],
  );
  return row
    ? {
        state: row.fresh ? "ready" : "stale",
        lastSeen: new Date(row.last_seen).toISOString(),
      }
    : { state: "unseen", lastSeen: null };
}
