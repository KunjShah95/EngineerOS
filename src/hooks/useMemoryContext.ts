import { useQuery } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";

/** A note linked to an open (not done) task — the seed of the memory layer. */
export interface OpenTaskNote {
  task_id: string;
  task_title: string;
  note_id: string;
  note_title: string;
}

export function openTaskNotesKey(workspaceId: string | null) {
  return ["memory_open_task_notes", workspaceId ?? ""] as const;
}

/**
 * Notes linked to tasks that aren't done yet. One query — joins task_notes →
 * tasks (inner, workspace-scoped, open only) → notes.
 */
export async function fetchOpenTaskNotes(workspaceId: string): Promise<OpenTaskNote[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("task_notes")
    .select(
      "task_id, note_id, task:tasks!inner(id, title, workspace_id, status), note:notes(id, title)"
    )
    .eq("task.workspace_id", workspaceId)
    .neq("task.status", "done")
    .is("task.deleted_at", null);

  if (error) throw error;
  const rows = (data ?? []) as unknown as {
    task_id: string;
    note_id: string;
    task: { title: string };
    note: { title: string };
  }[];
  return rows.map((r) => ({
    task_id: r.task_id,
    task_title: r.task.title,
    note_id: r.note_id,
    note_title: r.note.title,
  }));
}

export function useOpenTaskNotes(workspaceId: string | null) {
  return useQuery({
    queryKey: openTaskNotesKey(workspaceId),
    queryFn: () => fetchOpenTaskNotes(workspaceId!),
    enabled: Boolean(workspaceId),
  });
}
