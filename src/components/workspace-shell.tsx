import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Layers3,
  Link2,
  LoaderCircle,
  LogOut,
  ShieldCheck,
  X,
} from "lucide-react";
import type { Status, WorkspaceTab } from "./workspace-types";
import { Brand } from "./brand";
export function Sidebar({
  status,
  tab,
  onTabChange,
  onSignOut,
}: {
  status: Status | null;
  tab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
  onSignOut: () => void;
}) {
  return (
    <aside className="sidebar">
      <Brand />
      <div className="workspace-switch">
        <span className="workspace-avatar">P</span>
        <div>
          Plum Lending<small>Admin workspace</small>
        </div>
        <ChevronDown size={15} />
      </div>
      <p className="nav-label">WORKSPACE</p>
      <nav>
        <button
          className={tab === "builder" ? "nav-active" : ""}
          onClick={() => onTabChange("builder")}
        >
          <Layers3 size={18} />
          Audience builder
        </button>
        <button
          className={tab === "history" ? "nav-active" : ""}
          onClick={() => onTabChange("history")}
        >
          <Clock3 size={18} />
          Run history
          {status && status.jobs.length > 0 && (
            <span>{status.jobs.length}</span>
          )}
        </button>
        <button
          className={tab === "connections" ? "nav-active" : ""}
          onClick={() => onTabChange("connections")}
        >
          <Link2 size={18} />
          Connections
        </button>
      </nav>
      <div className="sidebar-note">
        <div className="mini-orbit">
          <ShieldCheck size={20} />
        </div>
        <strong>Context, kept intact.</strong>
        <p>
          Every conversation.
          <br />
          Every decision, traceable.
        </p>
      </div>
      <div className="profile">
        <span className="profile-avatar">PL</span>
        <div>
          Plum administrator
          <small>
            {status?.mode === "live" ? "Live workspace" : "Demo workspace"}
          </small>
        </div>
        {status?.mode === "live" && (
          <button title="Sign out" aria-label="Sign out" onClick={onSignOut}>
            <LogOut size={16} />
          </button>
        )}
      </div>
    </aside>
  );
}
export function Topbar({
  status,
  tab,
}: {
  status: Status | null;
  tab: WorkspaceTab;
}) {
  return (
    <header className="topbar">
      <span>
        Workspace <ChevronRight size={13} />{" "}
        <strong>
          {tab === "builder"
            ? "Audience builder"
            : tab === "history"
              ? "Run history"
              : "Connections"}
        </strong>
      </span>
      <div>
        <span
          className={`environment ${status?.mode === "live" ? "live" : ""}`}
        >
          <i />
          {status?.mode === "live" ? "Live data" : "Demo environment"}
        </span>
        <span className="top-avatar">PL</span>
      </div>
    </header>
  );
}
export function PageHeading({ tab }: { tab: WorkspaceTab }) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">RELATIONSHIP INTELLIGENCE</p>
        <h1>
          {tab === "builder"
            ? "Find the right conversations."
            : tab === "history"
              ? "Every run, accounted for."
              : "Your data, connected."}
        </h1>
        <p>
          {tab === "builder"
            ? "Turn your CRM and email history into a precise, explainable audience."
            : tab === "history"
              ? "Revisit your segments, inspect their results, and download an export."
              : "Bring your relationships and conversations together with read-only access."}
        </p>
      </div>
      {tab === "builder" && (
        <div className="heading-mark">
          <Layers3 size={25} />
        </div>
      )}
    </div>
  );
}
export function WorkspaceFeedback({
  status,
  error,
  notice,
  onDismissError,
  onDismissNotice,
}: {
  status: Status | null;
  error: string;
  notice: string;
  onDismissError: () => void;
  onDismissNotice: () => void;
}) {
  return (
    <>
      {error && (
        <div role="alert" className="banner error">
          <AlertTriangle size={18} />
          <span>{error}</span>
          <button aria-label="Dismiss error" onClick={onDismissError}>
            <X size={15} />
          </button>
        </div>
      )}
      {notice && (
        <div role="status" className="banner notice">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
          <button aria-label="Dismiss notification" onClick={onDismissNotice}>
            <X size={15} />
          </button>
        </div>
      )}
      {!status && !error && (
        <div className="panel loading">
          <LoaderCircle className="spin" />
          Opening your workspace…
        </div>
      )}
    </>
  );
}
export function WorkspaceFooter() {
  return (
    <footer className="page-footer">
      <span>
        <ShieldCheck size={13} /> Read-only sources · Complete thread context ·
        Traceable decisions
      </span>
      <span>PLUM / INTELLIGENCE</span>
    </footer>
  );
}

export function MobileNavigation({
  tab,
  onTabChange,
  onSignOut,
  live,
}: {
  tab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
  onSignOut: () => void;
  live: boolean;
}) {
  return (
    <nav className="mobile-nav" aria-label="Workspace navigation">
      <button
        className={tab === "builder" ? "selected" : ""}
        onClick={() => onTabChange("builder")}
      >
        Audience
      </button>
      <button
        className={tab === "history" ? "selected" : ""}
        onClick={() => onTabChange("history")}
      >
        Run history
      </button>
      <button
        className={tab === "connections" ? "selected" : ""}
        onClick={() => onTabChange("connections")}
      >
        Connections
      </button>
      {live && (
        <button aria-label="Sign out" onClick={onSignOut}>
          <LogOut size={15} />
        </button>
      )}
    </nav>
  );
}
