import { ChevronRight, Clock3, FileText } from "lucide-react";
import type { Status } from "./workspace-types";
export function RunHistory({
  status,
  onRefresh,
  onOpenJob,
  onBuildAudience,
}: {
  status: Status;
  onRefresh: () => void;
  onOpenJob: (id: string) => void;
  onBuildAudience: () => void;
}) {
  return (
    <section className="panel history-panel">
      <div className="panel-title">
        <Clock3 size={19} />
        <div>
          <h2>Recent segment runs</h2>
          <p>The 12 most recent requests in this workspace.</p>
        </div>
        <button className="secondary" onClick={onRefresh}>
          Refresh
        </button>
      </div>
      {status.jobs.length ? (
        status.jobs.map((j) => (
          <button
            key={j.id}
            className="history-row"
            onClick={() => onOpenJob(j.id)}
          >
            <span className="history-icon">
              <FileText size={19} />
            </span>
            <div>
              <strong>{j.query}</strong>
              <small>
                {new Date(j.created_at).toLocaleString()} · {j.counts.contacts}{" "}
                contacts · {j.counts.threads} threads
              </small>
            </div>
            <span className={`status-pill ${j.status}`}>{j.status}</span>
            <ChevronRight size={17} />
          </button>
        ))
      ) : (
        <div className="empty-state">
          <Clock3 size={28} />
          <h3>A clean slate</h3>
          <p>Your first segment run will appear here.</p>
          <button className="secondary" onClick={onBuildAudience}>
            Build an audience
          </button>
        </div>
      )}
    </section>
  );
}
