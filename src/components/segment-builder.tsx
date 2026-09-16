import {
  ArrowRight,
  Check,
  CheckCircle2,
  FileText,
  Layers3,
  LoaderCircle,
  Mail,
  MessageSquare,
  Play,
  Plus,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { DEFAULT_QUERY } from "@/domain/segment";
import type { Interpretation, Status } from "./workspace-types";
const date = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
export function SegmentForm({
  status,
  query,
  busy,
  active,
  onQueryChange,
  onInterpret,
}: {
  status: Status;
  query: string;
  busy: string | null;
  active: boolean;
  onQueryChange: (value: string) => void;
  onInterpret: () => void;
}) {
  return (
    <section className="panel segment-panel">
      <div className="panel-title">
        <div className="title-icon">
          <Sparkles size={18} />
        </div>
        <div>
          <h2>Build an audience</h2>
          <p>Describe the relationships you want to reconnect with.</p>
        </div>
        <span className="step-label">01 / DEFINE</span>
      </div>
      <label className="sr-only" htmlFor="segment-query">
        Segment request
      </label>
      <div className="query-wrap">
        <textarea
          id="segment-query"
          value={query}
          maxLength={2000}
          onChange={(e) => onQueryChange(e.target.value)}
          rows={3}
          spellCheck={false}
        />
        <span className="query-corner">
          <MessageSquare size={15} />
        </span>
      </div>
      <div className="query-tools">
        <button
          className="example-button"
          onClick={() => onQueryChange(DEFAULT_QUERY)}
        >
          <Plus size={13} /> Use example request
        </button>
        <span>Plain language. Precise criteria.</span>
      </div>
      <div className="query-footer">
        <p>
          <ShieldCheck size={15} />
          {status.mode === "demo"
            ? "Synthetic data only · no credentials required" +
              " · use the example wording; AI is available in live mode"
            : "Only this request is sent for AI interpretation"}
        </p>
        <button
          className="primary"
          disabled={Boolean(busy) || active || query.trim().length < 20}
          onClick={onInterpret}
        >
          {busy === "interpret" ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <Sparkles size={16} />
          )}
          Interpret request <ArrowRight size={16} />
        </button>
      </div>
    </section>
  );
}
export function SegmentReview({
  status,
  interpretation,
  scenario,
  busy,
  active,
  onScenarioChange,
  onRun,
}: {
  status: Status;
  interpretation: Interpretation;
  scenario: string;
  busy: string | null;
  active: boolean;
  onScenarioChange: (value: string) => void;
  onRun: () => void;
}) {
  return (
    <section className="panel interpretation" aria-label="Interpreted request">
      <div className="panel-title">
        <div className="title-icon green">
          <Check size={18} />
        </div>
        <div>
          <h2>Here’s how we’ll interpret it</h2>
          <p>Review the criteria before starting your export.</p>
        </div>
        <span className="step-label">02 / REVIEW</span>
      </div>
      <div className="criteria-grid">
        <div>
          <small>CONTACT TYPE</small>
          <strong>Sponsor</strong>
          <span>
            {status.sponsorProperty} = {status.sponsorValue}
          </span>
        </div>
        <div>
          <small>EMAIL WINDOW · UTC</small>
          <strong>
            {date(interpretation.spec.startInclusive)} –{" "}
            {date(interpretation.spec.endExclusive)}
          </strong>
          <span>Start inclusive · end exclusive</span>
        </div>
        <div>
          <small>DEAL HISTORY</small>
          <strong>No Closed Won deals</strong>
          <span>Direct contact associations · all time</span>
        </div>
      </div>
      <details className="assumptions" open>
        <summary>
          Interpretation & assumptions{" "}
          <span>{interpretation.assumptions.length}</span>
        </summary>
        <ul>
          {interpretation.assumptions.map((a) => (
            <li key={a}>
              <Check size={13} />
              {a}
            </li>
          ))}
        </ul>
        <div className="policy-note">
          As of {interpretation.spec.asOf} · {interpretation.source} ·
          deterministic eligibility
        </div>
      </details>
      <div className="run-footer">
        {status.mode === "demo" ? (
          <label className="scenario">
            Demo scenario{" "}
            <select
              aria-label="Demo scenario"
              value={scenario}
              onChange={(e) => onScenarioChange(e.target.value)}
            >
              <option value="standard">Standard dataset</option>
              <option value="partial">One thread unavailable</option>
              <option value="empty">No matching conversations</option>
              <option value="outage">Provider outage</option>
            </select>
          </label>
        ) : (
          <span className="muted">
            Complete threads will be retrieved from your connected mailbox.
          </span>
        )}
        <button
          className="primary"
          disabled={Boolean(busy) || active}
          onClick={onRun}
        >
          {busy === "run" ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <Play size={15} />
          )}
          Run segment
        </button>
      </div>
    </section>
  );
}
export function StartingState() {
  return (
    <section className="starting-state">
      <div className="empty-art">
        <div>
          <Users size={23} />
        </div>
        <span />
        <div>
          <Mail size={23} />
        </div>
      </div>
      <h3>Your next opportunity is already in your inbox.</h3>
      <p>
        Define an audience above. We’ll bring back the relevant contacts
        <br className="desktop-break" /> and the complete conversations behind
        them.
      </p>
      <div className="process-strip">
        <span>
          <CheckCircle2 size={14} />
          Review criteria
        </span>
        <ArrowRight size={12} />
        <span>
          <Layers3 size={14} />
          Preserve context
        </span>
        <ArrowRight size={12} />
        <span>
          <FileText size={14} />
          Export confidently
        </span>
      </div>
    </section>
  );
}
