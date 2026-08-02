import { useQuery } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import {
  PROJECT_FILTER_ALL,
  PROJECT_FILTER_UNFILED,
  type ProjectFilterValue,
} from "@/components/shell/ProjectFilter";

export interface MindMapNode {
  id: string;
  kind: "project" | "task" | "note";
  label: string;
  color: string | null;
  meta: string | null;
}

export interface MindMapEdge {
  source: string;
  target: string;
}

export interface MindMapData {
  nodes: MindMapNode[];
  edges: MindMapEdge[];
}

export async function fetchMindMapData(
  workspaceId: string,
  filter: ProjectFilterValue = PROJECT_FILTER_ALL
): Promise<MindMapData> {
  const supabase = createClient();

  const unfiled = filter === PROJECT_FILTER_UNFILED;
  const projectId = !unfiled && filter !== PROJECT_FILTER_ALL ? filter : null;

  const projectsPromise = unfiled
    ? Promise.resolve({ data: [], error: null })
    : (() => {
        let query = supabase
          .from("projects")
          .select("id, name, color")
          .eq("workspace_id", workspaceId)
          .is("deleted_at", null);
        if (projectId) query = query.eq("id", projectId);
        return query;
      })();

  let tasksQuery = supabase
    .from("tasks")
    .select("id, title, project_id, status")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null);
  if (unfiled) tasksQuery = tasksQuery.is("project_id", null);
  else if (projectId) tasksQuery = tasksQuery.eq("project_id", projectId);

  let notesQuery = supabase
    .from("notes")
    .select("id, title, project_id, pinned")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null);
  if (unfiled) notesQuery = notesQuery.is("project_id", null);
  else if (projectId) notesQuery = notesQuery.eq("project_id", projectId);

  const [projectsRes, tasksRes, notesRes] = await Promise.all([
    projectsPromise,
    tasksQuery,
    notesQuery,
  ]);

  // task_notes isn't workspace-scoped, so fetch them after we have task ids.
  const tasks = (tasksRes.data ?? []) as { id: string; title: string; project_id: string | null; status: string }[];
  const notes = (notesRes.data ?? []) as { id: string; title: string; project_id: string | null; pinned: boolean }[];
  const projects = (projectsRes.data ?? []) as { id: string; name: string; color: string | null }[];

  const taskIds = tasks.map((t) => t.id);
  const noteIds = notes.map((n) => n.id);
  const links: MindMapEdge[] = [];

  if (taskIds.length > 0) {
    const { data: tl, error } = await supabase
      .from("task_notes")
      .select("task_id, note_id")
      .in("task_id", taskIds);
    if (!error) {
      for (const l of tl ?? []) {
        if (noteIds.includes(l.note_id)) links.push({ source: l.task_id, target: l.note_id });
      }
    }
  }

  const nodes: MindMapNode[] = [
    ...projects.map((p) => ({
      id: p.id,
      kind: "project" as const,
      label: p.name,
      color: p.color,
      meta: "project",
    })),
    ...tasks.map((t) => ({
      id: t.id,
      kind: "task" as const,
      label: t.title,
      color: null,
      meta: t.status,
    })),
    ...notes.map((n) => ({
      id: n.id,
      kind: "note" as const,
      label: n.title,
      color: null,
      meta: n.pinned ? "pinned" : "note",
    })),
  ];

  const edges: MindMapEdge[] = [];
  const seen = new Set<string>();
  const addEdge = (s: string, t: string) => {
    const key = [s, t].sort().join("|");
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ source: s, target: t });
  };

  for (const p of projects) {
    for (const t of tasks) if (t.project_id === p.id) addEdge(p.id, t.id);
    for (const n of notes) if (n.project_id === p.id) addEdge(p.id, n.id);
  }
  for (const l of links) addEdge(l.source, l.target);

  return { nodes, edges };
}

export function useMindMap(workspaceId: string | null, filter: ProjectFilterValue = PROJECT_FILTER_ALL) {
  return useQuery({
    queryKey: ["mindmap", workspaceId ?? "", filter],
    queryFn: () => fetchMindMapData(workspaceId!, filter),
    enabled: Boolean(workspaceId),
  });
}
