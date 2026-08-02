import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import type { Task, TaskPriority, TaskStatus, TaskWithProject } from "@/types/database";

export const TASK_STATUSES: TaskStatus[] = ["backlog", "todo", "in_progress", "done"];

export interface TaskFilters {
  projectId?: string | null;
  priority?: TaskPriority | null;
  dueDate?: string | null;
}

export function tasksQueryKey(workspaceId: string | null, filters?: TaskFilters | null) {
  return ["tasks", workspaceId ?? "", filters ?? null] as const;
}

const taskSelect = "*, project:projects(id, name, color)";

export async function fetchTasks(
  workspaceId: string,
  filters?: TaskFilters | null
): Promise<TaskWithProject[]> {
  const supabase = createClient();
  let query = supabase
    .from("tasks")
    .select(taskSelect)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null);

  if (filters?.projectId) query = query.eq("project_id", filters.projectId);
  if (filters?.priority && filters.priority !== "none") {
    query = query.eq("priority", filters.priority);
  }
  if (filters?.dueDate) query = query.eq("due_date", filters.dueDate);

  const { data, error } = await query.order("position", { ascending: true });

  if (error) throw error;
  return (data ?? []) as TaskWithProject[];
}

export function useTasks(workspaceId: string | null, filters?: TaskFilters | null) {
  return useQuery({
    queryKey: tasksQueryKey(workspaceId, filters),
    queryFn: () => fetchTasks(workspaceId!, filters),
    enabled: Boolean(workspaceId),
  });
}

export async function fetchTask(taskId: string): Promise<TaskWithProject | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(taskSelect)
    .eq("id", taskId)
    .maybeSingle();

  if (error) throw error;
  return data as TaskWithProject | null;
}

export function useTask(taskId: string | null) {
  return useQuery({
    queryKey: ["task", taskId ?? ""],
    queryFn: () => fetchTask(taskId!),
    enabled: Boolean(taskId),
  });
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  project_id?: string | null;
  due_date?: string | null;
  estimate?: number | null;
  position?: number;
  /** GitHub issue URL this task was imported from. */
  source_url?: string | null;
}

export function useCreateTask(workspaceId: string | null, filters?: TaskFilters | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      const supabase = createClient();

      // New tasks append to the end of their status column.
      const { count } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("status", input.status ?? "backlog")
        .is("deleted_at", null);

      const { data, error } = await supabase
        .from("tasks")
        .insert({
          workspace_id: workspaceId,
          title: input.title,
          description: input.description ?? null,
          status: input.status ?? "backlog",
          priority: input.priority ?? "none",
          project_id: input.project_id ?? null,
          due_date: input.due_date ?? null,
          estimate: input.estimate ?? null,
          position: count ?? 0,
          source_url: input.source_url ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksQueryKey(workspaceId, filters) });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export type TaskPatch = Partial<
  Pick<
    Task,
    "title" | "description" | "project_id" | "priority" | "due_date" | "estimate" | "status"
  >
>;

export function useUpdateTask(workspaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TaskPatch }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("tasks")
        .update(patch)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as Task;
    },
    onSettled: (_data, _error, variables) => {
      // Keep the open TaskDetailPanel (keyed on ["task", id]) in sync with edits.
      queryClient.invalidateQueries({ queryKey: ["task", variables.id] });
      queryClient.invalidateQueries({ queryKey: tasksQueryKey(workspaceId) });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

/**
 * Kanban drag: move one task into a status column at a position, and persist
 * the full new ordering for both affected columns. Returns the updated rows.
 */
export interface ReorderInput {
  taskId: string;
  newStatus: TaskStatus;
  /** Complete ordered id list for the destination column after the move. */
  orderedIds: string[];
  /** Complete ordered id list for the previous column (or null if same). */
  previousOrderedIds: string[] | null;
}

export function useReorderTasks(workspaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, newStatus, orderedIds, previousOrderedIds }: ReorderInput) => {
      const supabase = createClient();
      const updates: PromiseLike<unknown>[] = [];

      const setStatus =
        previousOrderedIds === null || !previousOrderedIds.includes(taskId)
          ? supabase
              .from("tasks")
              .update({ status: newStatus })
              .eq("id", taskId)
          : Promise.resolve();

      updates.push(setStatus);

      orderedIds.forEach((id, index) => {
        updates.push(
          supabase
            .from("tasks")
            .update({ status: newStatus, position: index })
            .eq("id", id)
        );
      });

      if (previousOrderedIds && previousOrderedIds.length > 0) {
        previousOrderedIds.forEach((id, index) => {
          updates.push(
            supabase
              .from("tasks")
              .update({ position: index })
              .eq("id", id)
          );
        });
      }

      const results = await Promise.all(updates);
      const firstError = results.find((r) => (r as { error?: unknown }).error);
      if (firstError) throw (firstError as { error: Error }).error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tasksQueryKey(workspaceId) });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

/** Soft-delete a task. */
export function useDeleteTask(workspaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("tasks")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tasksQueryKey(workspaceId) });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Task ⇄ notes (linked notes)
// ---------------------------------------------------------------------------

export interface LinkedNote {
  task_id: string;
  note_id: string;
  note: { id: string; title: string; project_id: string | null };
}

export async function fetchTaskLinkedNotes(taskId: string): Promise<LinkedNote[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("task_notes")
    .select("task_id, note_id, note:notes(id, title, project_id)")
    .eq("task_id", taskId);

  if (error) throw error;
  return (data ?? []) as unknown as LinkedNote[];
}

export function useTaskLinkedNotes(taskId: string | null) {
  return useQuery({
    queryKey: ["task_notes", taskId ?? ""],
    queryFn: () => fetchTaskLinkedNotes(taskId!),
    enabled: Boolean(taskId),
  });
}

export function useLinkNoteToTask(taskId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (noteId: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("task_notes")
        .insert({ task_id: taskId, note_id: noteId });

      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["task_notes", taskId ?? ""] });
    },
  });
}

export function useUnlinkNoteFromTask(taskId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (noteId: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("task_notes")
        .delete()
        .eq("task_id", taskId)
        .eq("note_id", noteId);

      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["task_notes", taskId ?? ""] });
    },
  });
}
