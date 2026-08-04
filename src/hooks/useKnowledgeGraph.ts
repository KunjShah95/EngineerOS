import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import { buildWikilinkIndex, extractWikilinks, resolveWikilink } from "@/lib/wikilinks";
import { resourceHref } from "@/lib/resource-kind";
import type { GraphEdge, GraphEntityKind, GraphNode, KnowledgeGraph, NoteLink, ResourceKind } from "@/types/database";

export function knowledgeGraphKey(workspaceId: string | null) {
  return ["knowledge_graph", workspaceId ?? ""] as const;
}

const noteHref = (id: string) => `/notes/${id}`;
const taskHref = (id: string) => `/tasks?task=${id}`;

export async function fetchKnowledgeGraph(workspaceId: string): Promise<KnowledgeGraph> {
  const supabase = createClient();

  // Order matters for wikilink resolution: notes first, then tasks, then
  // resources, so a title collision resolves to the earliest entity.
  // task_notes / note_links have no workspace_id column — their RLS policies
  // scope reads through the parent entities (task / both notes), so the
  // unfiltered fetches below are already workspace-limited.
  const [notesRes, tasksRes, resourcesRes, linksRes, noteLinksRes] = await Promise.all([
    supabase
      .from("notes")
      .select("id, title, body_markdown, project_id")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null),
    supabase
      .from("tasks")
      .select("id, title, description, status, project_id")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null),
    supabase
      .from("resources")
      .select("id, title, body_markdown, kind, project_id")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null),
    supabase.from("task_notes").select("task_id, note_id"),
    supabase.from("note_links").select("note_id, linked_note_id"),
  ]);

  const notes = (notesRes.data ?? []) as {
    id: string;
    title: string;
    body_markdown: string;
    project_id: string | null;
  }[];
  const tasks = (tasksRes.data ?? []) as {
    id: string;
    title: string;
    description: string | null;
    status: string;
    project_id: string | null;
  }[];
  const resources = (resourcesRes.data ?? []) as {
    id: string;
    title: string;
    body_markdown: string;
    kind: string;
    project_id: string | null;
  }[];
  const taskNoteRows = (linksRes.data ?? []) as { task_id: string; note_id: string }[];
  const noteLinkRows = (noteLinksRes.data ?? []) as NoteLink[];

  const nodes: GraphNode[] = [
    ...notes.map((n) => ({
      id: n.id,
      kind: "note" as GraphEntityKind,
      label: n.title,
      href: noteHref(n.id),
      meta: "note",
      color: null as string | null,
      project_id: n.project_id,
    })),
    ...tasks.map((t) => ({
      id: t.id,
      kind: "task" as GraphEntityKind,
      label: t.title,
      href: taskHref(t.id),
      meta: t.status,
      color: null as string | null,
      project_id: t.project_id,
    })),
    ...resources.map((r) => ({
      id: r.id,
      kind: "resource" as GraphEntityKind,
      label: r.title,
      href: resourceHref(r.kind as ResourceKind, r.id),
      meta: r.kind,
      color: null as string | null,
      project_id: r.project_id,
    })),
  ];

  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  const addEdge = (source: string, target: string, kind: GraphEdge["kind"]) => {
    if (source === target) return;
    if (!nodeIds.has(source) || !nodeIds.has(target)) return;
    const key = `${source}|${target}|${kind}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ source, target, kind });
  };

  // Explicit task↔note links (the Phase 9 seed table).
  for (const l of taskNoteRows) addEdge(l.task_id, l.note_id, "task_note");
  // Explicit note→note links (note_links, directed).
  for (const l of noteLinkRows) addEdge(l.note_id, l.linked_note_id, "note_link");

  // Auto-detected wikilinks from body text.
  const index = buildWikilinkIndex([
    ...notes.map((n) => ({ id: n.id, kind: "note", title: n.title })),
    ...tasks.map((t) => ({ id: t.id, kind: "task", title: t.title })),
    ...resources.map((r) => ({ id: r.id, kind: "resource", title: r.title })),
  ]);
  const scan = (sourceId: string, text: string) => {
    for (const target of extractWikilinks(text)) {
      const hit = resolveWikilink(index, target);
      if (hit && hit.id !== sourceId) addEdge(sourceId, hit.id, "wikilink");
    }
  };
  for (const n of notes) scan(n.id, `${n.title}\n${n.body_markdown}`);
  for (const t of tasks) scan(t.id, `${t.title}\n${t.description ?? ""}`);
  for (const r of resources) scan(r.id, `${r.title}\n${r.body_markdown}`);

  return { nodes, edges };
}

export function useKnowledgeGraph(workspaceId: string | null) {
  return useQuery({
    queryKey: knowledgeGraphKey(workspaceId),
    queryFn: () => fetchKnowledgeGraph(workspaceId!),
    enabled: Boolean(workspaceId),
  });
}

// ---------------------------------------------------------------------------
// Note-link CRUD (explicit curated backlinks)
// ---------------------------------------------------------------------------

export function useAddNoteLink(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ noteId, linkedNoteId }: { noteId: string; linkedNoteId: string }) => {
      const supabase = createClient();
      const { error } = await supabase.from("note_links").upsert(
        { note_id: noteId, linked_note_id: linkedNoteId },
        { onConflict: "note_id,linked_note_id" }
      );
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeGraphKey(workspaceId) });
    },
  });
}

export function useRemoveNoteLink(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ noteId, linkedNoteId }: { noteId: string; linkedNoteId: string }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("note_links")
        .delete()
        .eq("note_id", noteId)
        .eq("linked_note_id", linkedNoteId);
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeGraphKey(workspaceId) });
    },
  });
}
