import { NextResponse, type NextRequest } from "next/server";

import { requireWorkspace } from "@/lib/supabase/auth";
import { registerBuiltinTools, executeTool, clearTools } from "@/lib/agent/tools";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    tool?: string;
    input?: unknown;
  } | null;
  if (!body?.tool) return NextResponse.json({ error: "missing tool" }, { status: 400 });

  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, workspace, user } = auth;

  const canWrite = workspace.role !== "viewer"; // null (pre-tenancy) treated as owner

  // Register tools with workspace-scoped handlers for this request.
  clearTools();
  registerBuiltinTools({
    searchKnowledge: async (input) => {
      const { data } = await supabase
        .from("notes")
        .select("id, title, body_markdown")
        .eq("workspace_id", workspace.id)
        .is("deleted_at", null)
        .or(`title.ilike.%${input.query}%,body_markdown.ilike.%${input.query}%`)
        .limit(input.k);
      return { hits: data ?? [] };
    },
    getProjectContext: async (input) => {
      const { data: project } = await supabase
        .from("projects")
        .select("*")
        .eq("id", input.projectId)
        .eq("workspace_id", workspace.id)
        .maybeSingle();
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title, status, priority")
        .eq("workspace_id", workspace.id)
        .eq("project_id", input.projectId)
        .is("deleted_at", null);
      const { data: notes } = await supabase
        .from("notes")
        .select("id, title")
        .eq("workspace_id", workspace.id)
        .eq("project_id", input.projectId)
        .is("deleted_at", null);
      return { project: project ?? null, tasks: tasks ?? [], notes: notes ?? [] };
    },
    listBlockedTasks: async (input) => {
      let q = supabase
        .from("tasks")
        .select("id, title, status, priority, project_id")
        .eq("workspace_id", workspace.id)
        .is("deleted_at", null)
        .eq("status", "blocked");
      if (input.projectId) q = q.eq("project_id", input.projectId);
      const { data } = await q;
      return { tasks: data ?? [] };
    },
    createTask: async (input) => {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          workspace_id: workspace.id,
          title: input.title,
          priority: input.priority,
          project_id: input.projectId ?? null,
          status: "todo",
          position: 0,
          subtasks: [],
        })
        .select("id, title")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    updateTaskStatus: async (input) => {
      const { data, error } = await supabase
        .from("tasks")
        .update({ status: input.status })
        .eq("id", input.taskId)
        .eq("workspace_id", workspace.id)
        .select("id, title, status")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    // Legacy compatibility
    searchNotes: async (input) => {
      const { data } = await supabase
        .from("notes")
        .select("id, title, body_markdown")
        .eq("workspace_id", workspace.id)
        .is("deleted_at", null)
        .ilike("title", `%${input.query}%`)
        .limit(input.k);
      return { hits: data ?? [] };
    },
    inspectTask: async (input) => {
      const { data: task } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", input.taskId)
        .eq("workspace_id", workspace.id)
        .maybeSingle();
      return { task: task ?? null };
    },
    updateNote: async (input) => {
      const patch: Record<string, unknown> = {};
      if (input.patch.title) patch.title = input.patch.title;
      if (input.patch.content) patch.body_markdown = input.patch.content;
      const { data, error } = await supabase
        .from("notes")
        .update(patch)
        .eq("id", input.noteId)
        .eq("workspace_id", workspace.id)
        .select("id, title")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const result = await executeTool(body.tool, body.input ?? {}, {
    userId: user.id,
    workspaceId: workspace.id,
    canWrite,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}