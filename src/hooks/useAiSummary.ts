import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import type { AiSummary, SummaryEntityType } from "@/types/database";

export function useAiSummary(workspaceId: string | null, entityType: SummaryEntityType, entityId: string | null) {
  return useQuery({
    queryKey: ["ai_summary", workspaceId ?? "", entityType, entityId ?? ""],
    queryFn: async () => {
      if (!entityId) return null;
      const supabase = createClient();
      const { data, error } = await supabase
        .from("ai_summaries")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .maybeSingle();
      if (error) throw error;
      return data as AiSummary | null;
    },
    enabled: Boolean(workspaceId) && Boolean(entityId),
  });
}

export function useGenerateSummary(
  workspaceId: string | null,
  entityType: SummaryEntityType,
  entityId: string | null
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity_type: entityType, entity_id: entityId }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error ?? "Summary failed");
      }
      return (await res.json()) as { summary: string; model: string; local: boolean };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai_summary", workspaceId ?? "", entityType, entityId ?? ""] });
    },
  });
}
