"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";

export function useProactiveNudges(workspaceId: string | null) {
  const today = new Date().toISOString().slice(0, 10);

  const { data: overdue } = useQuery({
    queryKey: ["proactive-nudges", workspaceId],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("tasks")
        .select("id, title, due_date")
        .eq("workspace_id", workspaceId!)
        .is("deleted_at", null)
        .lt("due_date", today)
        .neq("status", "done")
        .order("due_date", { ascending: true })
        .limit(5);
      return data ?? [];
    },
    enabled: Boolean(workspaceId),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!overdue?.length) return;
    const count = overdue.length;
    const label = count === 1 ? `"${overdue[0]!.title}"` : `${count} tasks`;
    const description =
      count === 1
        ? `Due ${overdue[0]!.due_date} — still open.`
        : overdue
            .slice(0, 3)
            .map((t: { title: string }) => t.title)
            .join(", ") + (count > 3 ? ` +${count - 3} more` : "");
    toast.warning(`${label} overdue`, {
      description,
      duration: 8000,
      id: "proactive-nudge",
    });
  }, [overdue]);
}
