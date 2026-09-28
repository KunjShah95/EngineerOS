import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import type { DecisionConflict, DecisionRecord } from "@/types/database";

/** Open stale-decision alerts for the workspace. */
export function useDecisionConflicts(workspaceId: string | null) {
  return useQuery({
    queryKey: ["decisions", workspaceId ?? "", "conflicts"],
    queryFn: async (): Promise<DecisionConflict[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("decision_conflicts")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .eq("status", "open")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DecisionConflict[];
    },
    enabled: Boolean(workspaceId),
  });
}

/**
 * Accept: the earlier decision is marked superseded by the newer one.
 * Dismiss: the alert is closed and won't be raised again for this pair.
 */
export function useResolveConflict(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ conflict, accept }: { conflict: DecisionConflict; accept: boolean }) => {
      const supabase = createClient();
      if (accept) {
        const { error } = await supabase
          .from("decision_records")
          .update({ status: "superseded", superseded_by: conflict.decision_id })
          .eq("id", conflict.earlier_decision_id);
        if (error) throw error;
      }
      const { error } = await supabase
        .from("decision_conflicts")
        .update({ status: accept ? "accepted" : "dismissed", resolved_at: new Date().toISOString() })
        .eq("id", conflict.id);
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["decisions", workspaceId ?? ""] });
    },
  });
}

/** Undo "superseded" — the earlier decision turns out to still hold. */
export function useReactivateDecision(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("decision_records")
        .update({ status: "active", superseded_by: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["decisions", workspaceId ?? ""] });
    },
  });
}

export type RelatedDecision = Pick<
  DecisionRecord,
  "id" | "note_id" | "title" | "decision" | "context" | "source_url" | "created_at"
>;

/**
 * Past decisions related to `text` (e.g. a task title being typed). Debounced
 * so typing doesn't fire an embedding call per keystroke; failures resolve to
 * an empty list because this is a hint, never a blocker.
 */
export function useRelatedDecisions(workspaceId: string | null, text: string, delayMs = 600) {
  const [debounced, setDebounced] = useState(text.trim());
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(text.trim()), delayMs);
    return () => window.clearTimeout(t);
  }, [text, delayMs]);

  return useQuery({
    queryKey: ["decisions", workspaceId ?? "", "related", debounced],
    queryFn: async (): Promise<RelatedDecision[]> => {
      const res = await fetch("/api/decisions/related", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: debounced }),
      });
      if (!res.ok) return [];
      const json = (await res.json().catch(() => null)) as { decisions?: RelatedDecision[] } | null;
      return json?.decisions ?? [];
    },
    enabled: Boolean(workspaceId) && debounced.length >= 8,
    staleTime: 60_000,
  });
}

const CAPTURE_ERRORS: Record<string, string> = {
  "too-short": "Paste a bit more — that's too short to hold a decision",
  "too-long": "That's over 60,000 characters — paste the relevant part of the thread",
};

export function useCaptureChat(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { text: string; source: string }) => {
      const res = await fetch("/api/ai/capture-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = (await res.json().catch(() => null)) as
        | { note_id?: string; decision?: string; error?: string }
        | null;
      if (!res.ok || !json?.note_id) {
        throw new Error(CAPTURE_ERRORS[json?.error ?? ""] ?? json?.error ?? "Capture failed");
      }
      return { noteId: json.note_id, decision: json.decision ?? "failed" };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["decisions", workspaceId ?? ""] });
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });
}

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
    mutationFn: async (noteId: string): Promise<{ status: "saved" | "no-decision"; conflicts: number }> => {
      const res = await fetch("/api/ai/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note_id: noteId }),
      });
      const json = (await res.json().catch(() => null)) as
        | { status?: string; error?: string; conflicts?: number }
        | null;
      if (!res.ok) throw new Error(EXTRACT_ERRORS[json?.error ?? ""] ?? json?.error ?? "Extraction failed");
      return { status: json?.status === "saved" ? "saved" : "no-decision", conflicts: json?.conflicts ?? 0 };
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
