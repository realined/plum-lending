import type { SegmentSpec } from "@/domain/segment";
import type { ExportRow } from "@/domain/models";
import type { Job } from "@/server/repository";
import type { SetupCheck } from "@/server/readiness";
import type { WorkerStatus } from "@/server/worker-status";
export type WorkspaceTab = "builder" | "history" | "connections";
export type Connection = {
  id: string;
  provider: string;
  status: string;
  mailbox: string | null;
  lastSync: string | null;
};
export type Status = {
  mode: "demo" | "live";
  connections: Connection[];
  jobs: Job[];
  workerMode: string;
  worker: WorkerStatus;
  sponsorProperty: string;
  sponsorValue: string;
  setup: SetupCheck[];
};
export type Interpretation = {
  id: string;
  query: string;
  spec: SegmentSpec;
  assumptions: string[];
  source: string;
};
export type JobResponse = {
  job: Job;
  rows: ExportRow[];
  totalRows: number;
  offset: number;
};
