import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import type { Note, NoteWithRelations } from "@/types/database";

export interface NotesFilters {
  projectId?: string | null;
}

export function notesQueryKey(workspaceId: string | null, filters?: NotesFilters | null) {
  return ["notes", workspaceId ?? "", filters ?? null] as const;
}

const noteSelect =
  "*, project:projects(id, name, color), note_tags(tag:tags(*))";

export async function fetchNotes(
  workspaceId: string,
  filters?: NotesFilters | null
): Promise<NoteWithRelations[]> {
  const supabase = createClient();
  let query = supabase
    .from("notes")
    .select(noteSelect)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null);

  if (filters?.projectId) {
    query = query.eq("project_id", filters.projectId);
  }

  const { data, error } = await query
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as NoteWithRelations[];
}

export async function fetchNote(noteId: string): Promise<NoteWithRelations | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("notes")
    .select(noteSelect)
    .eq("id", noteId)
    .maybeSingle();

  if (error) throw error;
  return data as NoteWithRelations | null;
}

export function useNotes(workspaceId: string | null, filters?: NotesFilters | null) {
  return useQuery({
    queryKey: notesQueryKey(workspaceId, filters),
    queryFn: () => fetchNotes(workspaceId!, filters),
    enabled: Boolean(workspaceId),
  });
}

export function useNote(noteId: string) {
  return useQuery({
    queryKey: ["note", noteId],
    queryFn: () => fetchNote(noteId),
    enabled: Boolean(noteId),
  });
}

export interface CreateNoteInput {
  title?: string;
  body_markdown?: string;
  project_id?: string | null;
}

export function useCreateNote(workspaceId: string | null, filters?: NotesFilters | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateNoteInput) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("notes")
        .insert({
          workspace_id: workspaceId,
          title: input.title ?? "Untitled",
          body_markdown: input.body_markdown ?? "",
          project_id: input.project_id ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Note;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notesQueryKey(workspaceId, filters) });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export type NotePatch = Partial<
  Pick<Note, "title" | "body_markdown" | "project_id" | "pinned" | "status">
>;

export function useUpdateNote(noteId: string, workspaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patch: NotePatch) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("notes")
        .update(patch)
        .eq("id", noteId)
        .select()
        .single();

      if (error) throw error;
      return data as Note;
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: ["note", noteId] });
      const previous = queryClient.getQueryData<NoteWithRelations | null>(["note", noteId]);

      if (previous) {
        queryClient.setQueryData<NoteWithRelations | null>(["note", noteId], {
          ...previous,
          ...patch,
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["note", noteId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["note", noteId] });
      queryClient.invalidateQueries({ queryKey: notesQueryKey(workspaceId, null) });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

/** Soft-delete a note. */
export function useDeleteNote(noteId: string, workspaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from("notes")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", noteId);

      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notesQueryKey(workspaceId, null) });
      queryClient.invalidateQueries({ queryKey: ["note", noteId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Note ⇄ tags (many-to-many via note_tags)
// ---------------------------------------------------------------------------

export function useSetNoteTags(noteId: string, workspaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tagIds: string[]) => {
      const supabase = createClient();

      const { error: delError } = await supabase
        .from("note_tags")
        .delete()
        .eq("note_id", noteId);
      if (delError) throw delError;

      if (tagIds.length > 0) {
        const { error: insError } = await supabase
          .from("note_tags")
          .insert(tagIds.map((tag_id) => ({ note_id: noteId, tag_id })));
        if (insError) throw insError;
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["note", noteId] });
      queryClient.invalidateQueries({ queryKey: notesQueryKey(workspaceId, null) });
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });
}
