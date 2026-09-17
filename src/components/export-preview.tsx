import {
  ArrowDownToLine,
  ChevronLeft,
  ChevronRight,
  Search,
  ShieldCheck,
} from "lucide-react";
import type { ExportRow } from "@/domain/models";
import type { JobResponse } from "./workspace-types";
import { ResultTable } from "./results";
export function ExportPreview({
  data,
  search,
  onSearchChange,
  onSelect,
  onPageChange,
  loadingPage = false,
}: {
  data: JobResponse;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (row: ExportRow) => void;
  onPageChange: (offset: number) => void;
  loadingPage?: boolean;
}) {
  return (
    <section className="panel results-panel">
      <div className="results-header">
        <div>
          <div className="results-title">
            <h2>Audience preview</h2>
            <span>{data.totalRows} rows</span>
          </div>
          <p>
            One row per contact and email thread. A contact with multiple
            threads appears more than once. Click a row to read the full conversation.
          </p>
        </div>
        <a className="primary download" href={`/api/jobs/${data.job.id}/csv`}>
          <ArrowDownToLine size={16} />
          Download CSV
        </a>
      </div>
      {data.totalRows > 0 ? (
        <>
          <div className="table-toolbar">
            <label>
              <Search size={15} />
              <input
                aria-label="Filter visible results"
                placeholder="Filter this page by name or account…"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </label>
            <span>
              <ShieldCheck size={13} /> Eligibility verified
            </span>
          </div>
          <ResultTable
            rows={data.rows.filter((r) =>
              `${r.firstName} ${r.lastName} ${r.accountName} ${r.subject}`
                .toLowerCase()
                .includes(search.toLowerCase()),
            )}
            onSelect={onSelect}
          />
          <div className="table-footer">
            <span>
              Showing {data.offset + 1}–
              {Math.min(data.offset + 25, data.totalRows)} of {data.totalRows}{" "}
              rows · 8 export columns
            </span>
            <div>
              <button
                aria-label="Previous result page"
                disabled={loadingPage || data.offset === 0}
                onClick={() => onPageChange(Math.max(0, data.offset - 25))}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                aria-label="Next result page"
                disabled={loadingPage || data.offset + 25 >= data.totalRows}
                onClick={() => onPageChange(data.offset + 25)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <Search size={28} />
          <h3>No matching conversations</h3>
          <p>
            No contacts met all of the reviewed conditions. Try a broader date
            window.
          </p>
          <small>The CSV is available with the required column headers.</small>
        </div>
      )}
    </section>
  );
}
