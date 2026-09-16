import {
  AlertTriangle,
  CheckCircle2,
  Layers3,
  LoaderCircle,
  Mail,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { JobResponse } from "./workspace-types";
export function JobPanel({
  data,
  active,
  workerMode,
}: {
  data: JobResponse | null;
  active: boolean;
  workerMode: string;
}) {
  const finished = data && ["succeeded", "partial"].includes(data.job.status);
  return (
    <section
      className={`panel job-panel ${data?.job.status === "partial" ? "partial" : ""}`}
      aria-label="Segment run"
    >
      <div className="run-heading">
        <div className="title-icon">
          {active ? (
            <LoaderCircle className="spin" size={18} />
          ) : data?.job.status === "failed" ||
            data?.job.status === "partial" ? (
            <AlertTriangle size={18} />
          ) : (
            <CheckCircle2 size={18} />
          )}
        </div>
        <div>
          <h2>{data?.job.stage ?? "Starting your run"}</h2>
          <p>
            {active
              ? "Your job is saved. You can leave this page and return to Run history."
              : data?.job.status === "failed"
                ? data.job.error
                : finished
                  ? `${data.totalRows} contact/thread rows · full conversation context preserved`
                  : "Waiting for your worker"}
          </p>
        </div>
        <span className={`status-pill ${data?.job.status ?? "queued"}`}>
          {data?.job.status ?? "queued"}
        </span>
      </div>
      {active && (
        <>
          <div className="progress-track">
            <div style={{ width: `${data?.job.progress ?? 4}%` }} />
          </div>
          {data?.job.status === "queued" && (
            <p className="worker-hint">
              {workerMode === "external"
                ? "Waiting for the worker process. Start it with pnpm worker."
                : "The background worker will pick this up shortly."}
            </p>
          )}
        </>
      )}
      {data && (
        <>
          <details className="exclusion-details run-criteria">
            <summary>Criteria used for this run</summary>
            <p>{data.job.query}</p>
            <p>
              UTC: {data.job.spec.startInclusive} inclusive →{" "}
              {data.job.spec.endExclusive} exclusive.
            </p>
            <p>
              Sponsor · inbound contact-sent email · no directly associated
              Closed Won deal · full thread context.
            </p>
          </details>
          <div className="metrics">
            {[
              ["Contacts", data.job.counts.contacts, Users],
              ["Threads", data.job.counts.threads, Layers3],
              ["Messages", data.job.counts.messages, Mail],
              ["Excluded", data.job.counts.excluded, ShieldCheck],
              ["Failures", data.job.counts.failures, AlertTriangle],
            ].map(([label, value, Icon]) => {
              const Glyph = Icon as typeof Users;
              return (
                <div key={String(label)}>
                  <span>
                    <Glyph size={14} />
                    {String(label)}
                  </span>
                  <strong>{String(value)}</strong>
                </div>
              );
            })}
          </div>
          {data.job.status === "partial" && (
            <div className="partial-notice">
              <AlertTriangle size={16} />
              <div>
                <strong>Some data could not be verified.</strong>
                <p>
                  Successful results are available. This export is incomplete;
                  review the gaps before using it.
                </p>
                <ul>
                  {data.job.failures.map((f, i) => (
                    <li key={i}>
                      {f.scope}: {f.code}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {Object.keys(data.job.exclusions).length > 0 && (
            <details className="exclusion-details">
              <summary>Why contacts were excluded</summary>
              {Object.entries(data.job.exclusions).map(([reason, n]) => (
                <div key={reason}>
                  <span>{reason}</span>
                  <b>{n}</b>
                </div>
              ))}
            </details>
          )}
        </>
      )}
    </section>
  );
}
