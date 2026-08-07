"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";

/**
 * Subscribes to changes on the `tasks` table so the kanban board stays in sync
 * across tabs (per BACKEND_ROADMAP.md — realtime is tasks-only in V1).
 */
export function useTasksRealtime(workspaceId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!workspaceId) return;

    const supabase = createClient();
    const channel = supabase
      .channel("tasks-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => {
          // Prefix invalidation so both the unfiltered board and any
          // project/priority-filtered board refresh after a realtime change.
          queryClient.invalidateQueries({ queryKey: ["tasks", workspaceId ?? ""] });
          queryClient.invalidateQueries({ queryKey: ["projects"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, queryClient]);
}
