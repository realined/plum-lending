"use client";
import { useEffect, useState } from "react";
import type { JobResponse } from "./workspace-types";
import { request } from "./workspace-api";

export function useJob(
  jobId: string | null,
  onComplete: () => Promise<void>,
  onError: (message: string) => void,
) {
  const [response, setResponse] = useState<JobResponse | null>(null);
  const [page, setPage] = useState({ id: "", offset: 0 });
  const [failedId, setFailedId] = useState<string | null>(null);
  const offset = page.id === jobId ? page.offset : 0;
  useEffect(() => {
    if (!jobId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await request<JobResponse>(
          `jobs/${jobId}?offset=${offset}`,
          undefined,
          "GET",
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setResponse(next);
        setFailedId(null);
        if (["succeeded", "partial", "failed"].includes(next.job.status))
          void onComplete();
        else timer = setTimeout(() => void poll(), 1000);
      } catch (error) {
        if (controller.signal.aborted) return;
        setFailedId(jobId);
        onError((error as Error).message);
      }
    };
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [jobId, offset, onComplete, onError]);
  const data = response?.job.id === jobId ? response : null;
  const failed = failedId === jobId && Boolean(jobId);
  return {
    data,
    failed,
    active:
      !failed &&
      Boolean(jobId) &&
      (!data || ["queued", "running"].includes(data.job.status)),
    loadingPage: Boolean(data && data.offset !== offset && !failed),
    changePage: (next: number) => setPage({ id: jobId ?? "", offset: next }),
  };
}
