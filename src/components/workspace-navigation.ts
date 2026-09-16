"use client";
import { useRouter, useSearchParams } from "next/navigation";
import type { WorkspaceTab } from "./workspace-types";

export function workspaceUrl(tab: WorkspaceTab, run: string | null = null) {
  const params = new URLSearchParams({ view: tab });
  if (run) params.set("run", run);
  return `/?${params}`;
}

export function useWorkspaceNavigation() {
  const router = useRouter();
  const params = useSearchParams();
  const view = params.get("view");
  const tab: WorkspaceTab =
    view === "history" || view === "connections" ? view : "builder";
  const run = params.get("run");
  const jobId =
    run &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(run)
      ? run
      : null;
  const navigate = (next: WorkspaceTab, id: string | null = jobId) => {
    router.push(workspaceUrl(next, id), { scroll: false });
  };
  return { tab, jobId, navigate };
}
