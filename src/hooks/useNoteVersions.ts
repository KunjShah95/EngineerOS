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
