"use client";
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_QUERY } from "@/domain/segment";
import type { ExportRow } from "@/domain/models";
import type { Interpretation, Status } from "./workspace-types";
import { request } from "./workspace-api";
import { useWorkspaceNavigation } from "./workspace-navigation";
import { useJob } from "./use-job";
import {
  Sidebar,
  Topbar,
  MobileNavigation,
  PageHeading,
  WorkspaceFeedback,
  WorkspaceFooter,
} from "./workspace-shell";
import { LoginScreen } from "./login-screen";
import { ConnectionCards } from "./connection-cards";
import { ConnectionDetails, HubSpotDialog } from "./connections-panel";
import { SegmentForm, SegmentReview, StartingState } from "./segment-builder";
import { JobPanel } from "./job-panel";
import { ExportPreview } from "./export-preview";
import { RunHistory } from "./run-history";
import { ThreadDrawer } from "./results";
export function Workspace() {
  const [status, setStatus] = useState<Status | null>(null),
    [login, setLogin] = useState(false),
    [password, setPassword] = useState("");
  const [query, setQuery] = useState(DEFAULT_QUERY),
    [interpretation, setInterpretation] = useState<Interpretation | null>(null),
    [busy, setBusy] = useState<string | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [scenario, setScenario] = useState("standard"),
    [selected, setSelected] = useState<ExportRow | null>(null),
    [hubspot, setHubspot] = useState(false),
    [token, setToken] = useState("");
  const { tab, jobId, navigate } = useWorkspaceNavigation();
  const [search, setSearch] = useState("");
  const refresh = useCallback(async () => {
    try {
      setStatus(await request<Status>("status"));
      setLogin(false);
    } catch (e) {
      if ((e as { status?: number }).status === 401) setLogin(true);
      else setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      void refresh();
      const param = new URLSearchParams(window.location.search).get(
        "connection",
      );
      if (param) {
        setNotice(
          param === "gmail-connected"
            ? "Gmail is connected. Your read-only mailbox is ready."
            : "Google connection did not complete. Check consent, scopes, and redirect URI.",
        );
        window.history.replaceState({}, "", "/?view=connections");
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [refresh]);
  const {
    data,
    active,
    failed: jobFailed,
    loadingPage,
    changePage,
  } = useJob(jobId, refresh, setError);
  const action = async (name: string, fn: () => Promise<void>) => {
    setBusy(name);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const interpret = () =>
    action("interpret", async () => {
      setInterpretation(await request<Interpretation>("interpret", { query }));
    });
  const run = () =>
    action("run", async () => {
      if (!interpretation || interpretation.query !== query) return;
      const { id } = await request<{ id: string }>("jobs", {
        segmentId: interpretation.id,
        scenario,
      });
      navigate("builder", id);
      setInterpretation(null);
    });
  const finished = data && ["succeeded", "partial"].includes(data.job.status);
  const openJob = (id: string) => {
    setSearch("");
    setInterpretation(null);
    navigate("builder", id);
  };
  const newDraft = () => {
    setError("");
    setInterpretation(null);
    setSearch("");
    navigate("builder", null);
  };
  const signIn = () =>
    action("login", async () => {
      await request("login", { password });
      setPassword("");
      await refresh();
    });
  const signOut = () =>
    action("logout", async () => {
      await request("logout", {});
      setStatus(null);
      navigate("builder", null);
      setLogin(true);
    });
  const changeQuery = (value: string) => {
    setQuery(value);
    setInterpretation(null);
  };
  const disconnect = (provider: string) => {
    if (
      !window.confirm(
        "Disconnect this provider and delete all local normalized data, requests, and exports?",
      )
    )
      return;
    void action("disconnect", async () => {
      const result = await request<{ message: string }>(
        `connections/${provider}`,
        undefined,
        "DELETE",
      );
      setNotice(result.message);
      navigate("connections", null);
      await refresh();
    });
  };
  const deleteData = () => {
    if (
      !window.confirm(
        "Delete saved runs, imported records, and stored exports from this app’s database? Gmail messages, HubSpot records, connections, and downloaded CSV files will remain.",
      )
    )
      return;
    void action("delete", async () => {
      const result = await request<{ message: string }>(
        "data",
        undefined,
        "DELETE",
      );
      navigate("connections", null);
      setInterpretation(null);
      setNotice(result.message);
      await refresh();
    });
  };
  const connectHubSpot = () =>
    action("hubspot", async () => {
      await request("connections/hubspot", { token });
      setToken("");
      setHubspot(false);
      setNotice("HubSpot is connected and validated.");
      await refresh();
    });
  if (login)
    return (
      <LoginScreen
        password={password}
        busy={busy}
        error={error}
        onPasswordChange={setPassword}
        onSignIn={signIn}
      />
    );
  return (
    <div className="app-shell">
      <Sidebar status={status} tab={tab} onTabChange={navigate} />
      <div className="main-shell">
        <Topbar
          status={status}
          tab={tab}
          onTabChange={navigate}
          onSignOut={signOut}
        />
        <MobileNavigation
          tab={tab}
          onTabChange={navigate}
          onSignOut={() => void signOut()}
          live={status?.mode === "live"}
        />
        <main className="main-content">
          <PageHeading tab={tab} />
          <WorkspaceFeedback
            status={status}
            error={error}
            notice={notice}
            onDismissError={() => setError("")}
            onDismissNotice={() => setNotice("")}
          />
          {status && (
            <>
              {tab !== "history" && (
                <ConnectionCards
                  status={status}
                  tab={tab}
                  onConnectHubSpot={() => setHubspot(true)}
                  onDisconnect={disconnect}
                  onSetup={() => navigate("connections")}
                />
              )}
              {tab === "builder" && (
                <>
                  {!jobId && (
                    <SegmentForm
                      status={status}
                      query={query}
                      busy={busy}
                      active={active}
                      onQueryChange={changeQuery}
                      onInterpret={interpret}
                    />
                  )}
                  {!jobId &&
                    interpretation &&
                    interpretation.query === query && (
                      <SegmentReview
                        status={status}
                        interpretation={interpretation}
                        scenario={scenario}
                        busy={busy}
                        active={active}
                        onScenarioChange={setScenario}
                        onRun={run}
                      />
                    )}
                  {jobId && (
                    <div className="saved-run-heading">
                      <div>
                        <strong>Saved run</strong>
                        <p>
                          {data?.job.query ??
                            (jobFailed
                              ? "This run is unavailable."
                              : "Loading saved criteria…")}
                        </p>
                      </div>
                      <button className="secondary" onClick={newDraft}>
                        New segment
                      </button>
                    </div>
                  )}
                  {jobId && !jobFailed && (
                    <JobPanel
                      data={data}
                      active={active}
                      workerMode={status.workerMode}
                    />
                  )}
                  {finished && (
                    <ExportPreview
                      data={data}
                      search={search}
                      onSearchChange={setSearch}
                      onSelect={setSelected}
                      onPageChange={changePage}
                      loadingPage={loadingPage}
                    />
                  )}
                  {!jobId && !interpretation && <StartingState />}
                </>
              )}
              {tab === "history" && (
                <RunHistory
                  status={status}
                  onRefresh={refresh}
                  onOpenJob={openJob}
                  onBuildAudience={newDraft}
                />
              )}
              {tab === "connections" && (
                <ConnectionDetails
                  status={status}
                  busy={busy}
                  onDeleteData={deleteData}
                />
              )}
              <WorkspaceFooter />
            </>
          )}
        </main>
      </div>
      {selected && (
        <ThreadDrawer row={selected} onClose={() => setSelected(null)} />
      )}
      {hubspot && (
        <HubSpotDialog
          status={status}
          token={token}
          busy={busy}
          error={error}
          onTokenChange={setToken}
          onClose={() => {
            setHubspot(false);
            setToken("");
          }}
          onConnect={connectHubSpot}
        />
      )}
    </div>
  );
}
