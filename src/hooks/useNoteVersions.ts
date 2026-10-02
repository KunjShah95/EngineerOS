import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import type { NoteVersion } from "@/types/database";

export function useNoteVersions(noteId: string | null) {
  return useQuery({
    queryKey: ["note_versions", noteId ?? ""],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("note_versions")
        .select("*")
        .eq("note_id", noteId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as NoteVersion[];
    },
    enabled: Boolean(noteId),
  });
}

/**
 * Seed version history for notes that predate versioning. Lets time-travel
 * answers reconstruct more than "no snapshot exists". Idempotent server-side.
 */
export function useBackfillNoteVersions() {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ai/versions/backfill", { method: "POST" });
      const json = (await res.json().catch(() => null)) as
        | { inserted: number; backdated: number; fromNow: number; skipped: number; error: string | null }
        | { error: string }
        | null;
      if (!res.ok || !json) throw new Error("error" in (json ?? {}) ? (json as { error: string }).error : "Backfill failed");
      return json as { inserted: number; backdated: number; fromNow: number; skipped: number; error: string | null };
    },
  });
}

export function useSaveNoteVersion(noteId: string | null, workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ title, body_markdown }: { title: string; body_markdown: string }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("note_versions")
        .insert({ note_id: noteId, workspace_id: workspaceId, title, body_markdown })
        .select()
        .single();
      if (error) throw error;
      return data as NoteVersion;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["note_versions", noteId ?? ""] });
    },
  });
}
