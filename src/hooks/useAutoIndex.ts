"use client";

import { useEffect } from "react";

/**
 * Background indexing: silently drains the index_queue on load and then on a
 * slow interval while the tab is visible. Each drain is fire-and-forget — it
 * never blocks the UI and failures are swallowed (the next interval retries).
 */
export function useAutoIndex(workspaceId: string | null, intervalMs = 5 * 60_000) {
  useEffect(() => {
    if (!workspaceId) return;

    const drain = () => {
      void fetch("/api/ai/index/drain", { method: "POST" }).catch(() => {});
    };

    // First pass after initial data loads settle — avoids competing with workspace/notes/tasks fetches.
    const first = window.setTimeout(drain, 10_000);
    // Then keep the index fresh while the app is open (and the tab visible).
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") drain();
    }, intervalMs);

    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [workspaceId, intervalMs]);
}
