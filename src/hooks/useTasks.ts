import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import {
  DependencyCycleError,
  wouldCreateDependencyCycle,
  type DependencyEdge,
} from "@/lib/task-dependencies";
import type {
  Tag,
  Task,
  TaskActivityRow,
  TaskComment,
  TaskPriority,
  TaskStatus,
  TaskWithProject,
} from "@/types/database";

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
    "title" | "description" | "project_id" | "priority" | "due_date" | "estimate" | "status" | "subtasks" | "time_spent"
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

// ---------------------------------------------------------------------------
// Task comments
// ---------------------------------------------------------------------------

export function useTaskComments(taskId: string | null) {
  return useQuery({
    queryKey: ["task_comments", taskId ?? ""],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("task_comments")
        .select("*")
        .eq("task_id", taskId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TaskComment[];
    },
    enabled: Boolean(taskId),
  });
}

export function useCreateTaskComment(taskId: string | null, workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("task_comments")
        .insert({ task_id: taskId, workspace_id: workspaceId, body })
        .select()
        .single();
      if (error) throw error;
      return data as TaskComment;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["task_comments", taskId ?? ""] });
    },
  });
}

export function useDeleteTaskComment(taskId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (commentId: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("task_comments")
        .delete()
        .eq("id", commentId);
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["task_comments", taskId ?? ""] });
    },
  });
}

// ---------------------------------------------------------------------------
// Task tags (task_tags junction)
// ---------------------------------------------------------------------------

export interface LinkedTaskTag {
  task_id: string;
  tag_id: string;
  tag: Tag;
}

export function useTaskTags(taskId: string | null) {
  return useQuery({
    queryKey: ["task_tags", taskId ?? ""],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("task_tags")
        .select("task_id, tag_id, tag:tags(*)")
        .eq("task_id", taskId!);
      if (error) throw error;
      return (data ?? []) as LinkedTaskTag[];
    },
    enabled: Boolean(taskId),
  });
}

export function useSetTaskTags(taskId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tagIds: string[]) => {
      const supabase = createClient();
      const { error: delError } = await supabase
        .from("task_tags")
        .delete()
        .eq("task_id", taskId);
      if (delError) throw delError;
      if (tagIds.length > 0) {
        const { error: insError } = await supabase
          .from("task_tags")
          .insert(tagIds.map((tag_id) => ({ task_id: taskId, tag_id })));
        if (insError) throw insError;
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["task_tags", taskId ?? ""] });
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Task dependencies (task_id depends on depends_on_task_id)
// ---------------------------------------------------------------------------

export interface TaskDependencies {
  /** Tasks this task depends on (prerequisites — block this task). */
  dependsOn: TaskWithProject[];
  /** Tasks that depend on this one (successors — blocked by this task). */
  blocking: TaskWithProject[];
}

export async function fetchTaskDependencies(taskId: string): Promise<TaskDependencies> {
  const supabase = createClient();
  const depsRes = await supabase
    .from("task_dependencies")
    .select("depends_on_task_id")
    .eq("task_id", taskId);
  const blockersRes = await supabase
    .from("task_dependencies")
    .select("task_id")
    .eq("depends_on_task_id", taskId);
  if (depsRes.error) throw depsRes.error;
  if (blockersRes.error) throw blockersRes.error;

  const deps = (depsRes.data ?? []) as { depends_on_task_id: string }[];
  const blockers = (blockersRes.data ?? []) as { task_id: string }[];

  const ids = [...new Set([...deps.map((d) => d.depends_on_task_id), ...blockers.map((b) => b.task_id)])];

  const tasks: TaskWithProject[] = [];
  if (ids.length > 0) {
    const { data, error } = await supabase
      .from("tasks")
      .select(taskSelect)
      .in("id", ids)
      .is("deleted_at", null);
    if (error) throw error;
    tasks.push(...((data ?? []) as TaskWithProject[]));
  }

  const byId = new Map(tasks.map((t) => [t.id, t]));
  return {
    dependsOn: deps
      .map((d) => byId.get(d.depends_on_task_id))
      .filter((t): t is TaskWithProject => Boolean(t)),
    blocking: blockers
      .map((b) => byId.get(b.task_id))
      .filter((t): t is TaskWithProject => Boolean(t)),
  };
}

export function useTaskDependencies(taskId: string | null) {
  return useQuery({
    queryKey: ["task_dependencies", taskId ?? ""],
    queryFn: () => fetchTaskDependencies(taskId!),
    enabled: Boolean(taskId),
  });
}

/**
 * Every dependency edge visible to the current user. No workspace filter is
 * needed — the RLS policy on task_dependencies already scopes reads to edges
 * whose task belongs to one of the user's workspaces (a single workspace in
 * this app), which is exactly the graph we must check for cycles.
 */
export async function fetchTaskDependencyGraph(): Promise<DependencyEdge[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("task_dependencies")
    .select("task_id, depends_on_task_id");
  if (error) throw error;
  return (data ?? []) as DependencyEdge[];
}

export function useTaskDependencyGraph(workspaceId: string | null) {
  return useQuery({
    queryKey: ["task_dependencies_graph", workspaceId ?? ""],
    queryFn: () => fetchTaskDependencyGraph(),
    enabled: Boolean(workspaceId),
  });
}

export function useAddTaskDependency(taskId: string | null, workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dependsOnTaskId: string) => {
      const supabase = createClient();
      // Cycle guard: adding taskId → dependsOnTaskId creates a loop exactly
      // when dependsOnTaskId already reaches taskId transitively.
      const graph = await fetchTaskDependencyGraph();
      if (wouldCreateDependencyCycle(graph, taskId!, dependsOnTaskId)) {
        throw new DependencyCycleError();
      }
      const { error } = await supabase
        .from("task_dependencies")
        .insert({ task_id: taskId, depends_on_task_id: dependsOnTaskId });
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["task_dependencies", taskId ?? ""] });
      queryClient.invalidateQueries({ queryKey: ["task_activity", taskId ?? ""] });
      queryClient.invalidateQueries({ queryKey: ["task_blocked", workspaceId ?? ""] });
      queryClient.invalidateQueries({ queryKey: ["task_dependencies_graph", workspaceId ?? ""] });
    },
  });
}

export function useRemoveTaskDependency(taskId: string | null, workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dependsOnTaskId: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("task_dependencies")
        .delete()
        .eq("task_id", taskId)
        .eq("depends_on_task_id", dependsOnTaskId);
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["task_dependencies", taskId ?? ""] });
      queryClient.invalidateQueries({ queryKey: ["task_activity", taskId ?? ""] });
      queryClient.invalidateQueries({ queryKey: ["task_blocked", workspaceId ?? ""] });
      queryClient.invalidateQueries({ queryKey: ["task_dependencies_graph", workspaceId ?? ""] });
    },
  });
}

// ---------------------------------------------------------------------------
// Task activity history (append-only, written by DB triggers)
// ---------------------------------------------------------------------------

export function useTaskActivity(taskId: string | null) {
  return useQuery({
    queryKey: ["task_activity", taskId ?? ""],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("task_activity")
        .select("*")
        .eq("task_id", taskId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as TaskActivityRow[];
    },
    enabled: Boolean(taskId),
  });
}

// ---------------------------------------------------------------------------
// Blocked indicators (for the kanban board + lists)
// ---------------------------------------------------------------------------

/** Ids of tasks that have at least one open dependency. */
export async function fetchBlockedTaskIds(workspaceId: string): Promise<Set<string>> {
  const supabase = createClient();
  // Dependencies pointing at tasks still open (not done).
  const { data, error } = await supabase
    .from("task_dependencies")
    .select("task_id, depends_on:depends_on_task_id!inner(workspace_id, status)")
    .eq("depends_on.workspace_id", workspaceId)
    .neq("depends_on.status", "done");
  if (error) throw error;
  return new Set(((data ?? []) as { task_id: string }[]).map((d) => d.task_id));
}

export function useBlockedTaskIds(workspaceId: string | null) {
  return useQuery({
    queryKey: ["task_blocked", workspaceId ?? ""],
    queryFn: () => fetchBlockedTaskIds(workspaceId!),
    enabled: Boolean(workspaceId),
  });
}

/** Activity for every task in a project (Sprint 4 — project Activity tab). */
export interface ProjectActivityRow extends TaskActivityRow {
  task: { id: string; title: string };
}

export function useProjectActivity(workspaceId: string | null, projectId: string | null) {
  return useQuery({
    queryKey: ["project_activity", workspaceId ?? "", projectId ?? ""],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("task_activity")
        .select("*, task:tasks!inner(id, title)")
        .eq("task.project_id", projectId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as ProjectActivityRow[];
    },
    enabled: Boolean(workspaceId) && Boolean(projectId),
  });
}
