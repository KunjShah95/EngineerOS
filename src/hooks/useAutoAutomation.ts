"use client";

import { useEffect } from "react";

/**
 * Background automation: silently drains the automation job queue + evaluates
 * due rules on load and then on a slow interval while the tab is visible.
 * Fire-and-forget — failures are swallowed (the next interval retries).
 */
export function useAutoAutomation(workspaceId: string | null, intervalMs = 5 * 60_000) {
  useEffect(() => {
    if (!workspaceId) return;

    const drain = () => {
      void fetch("/api/automation/drain", { method: "POST" }).catch(() => {});
    };

    const first = window.setTimeout(drain, 3000);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") drain();
    }, intervalMs);

    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [workspaceId, intervalMs]);
}
