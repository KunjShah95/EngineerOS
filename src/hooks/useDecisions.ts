import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import type { DecisionRecord } from "@/types/database";

export function useDecisions(workspaceId: string | null) {
  return useQuery({
    queryKey: ["decisions", workspaceId ?? ""],
    queryFn: async (): Promise<DecisionRecord[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("decision_records")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as DecisionRecord[];
    },
    enabled: Boolean(workspaceId),
  });
}

export function useNoteDecision(workspaceId: string | null, noteId: string | null) {
  return useQuery({
    queryKey: ["decisions", workspaceId ?? "", "note", noteId ?? ""],
    queryFn: async (): Promise<DecisionRecord | null> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("decision_records")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .eq("note_id", noteId!)
        .maybeSingle();
      if (error) throw error;
      return data as DecisionRecord | null;
    },
    enabled: Boolean(workspaceId) && Boolean(noteId),
  });
}

const EXTRACT_ERRORS: Record<string, string> = {
  "no-ai": "Add an AI provider key in Settings to extract decisions",
  "note-not-found": "Note not found",
};

export function useExtractDecision(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (noteId: string): Promise<{ status: "saved" | "no-decision" }> => {
      const res = await fetch("/api/ai/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note_id: noteId }),
      });
      const json = (await res.json().catch(() => null)) as { status?: string; error?: string } | null;
      if (!res.ok) throw new Error(EXTRACT_ERRORS[json?.error ?? ""] ?? json?.error ?? "Extraction failed");
      return { status: json?.status === "saved" ? "saved" : "no-decision" };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["decisions", workspaceId ?? ""] });
    },
  });
}

export function useDeleteDecision(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("decision_records").delete().eq("id", id);
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["decisions", workspaceId ?? ""] });
    },
  });
}
