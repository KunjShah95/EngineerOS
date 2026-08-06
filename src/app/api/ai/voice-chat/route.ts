import { NextResponse, type NextRequest } from "next/server";

import { requireWorkspace } from "@/lib/supabase/auth";
import { transcribeAudio } from "@/lib/ai";
import { answerWithContext, drainIndexQueue, retrieveWorkspace } from "@/lib/ai/rag";
import { answerWorkspaceQuestion } from "@/lib/ai/workspace-qa";
import { loadAiConfig } from "@/lib/ai/db-config";
import { runWithAiConfig } from "@/lib/ai/server-config";
import { getAiApiKey, getAiBaseUrl } from "@/lib/ai/server-config";
import type { ChatSource, TaskPriority, TaskStatus } from "@/types/database";

// ---------------------------------------------------------------------------
// Agentic tool definitions (OpenAI function-calling format)
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "create_task",
      description: "Create a new task in the workspace",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Task title" },
          priority: { type: "string", enum: ["none", "low", "medium", "high", "urgent"] },
          due_date: { type: "string", description: "ISO date string, e.g. 2026-08-10" },
          status: { type: "string", enum: ["backlog", "todo", "in_progress"] },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_note",
      description: "Create a new note in the workspace",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          content: { type: "string", description: "Optional markdown body" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_tasks",
      description: "List tasks from the workspace, optionally filtered by status",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["backlog", "todo", "in_progress", "done"] },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "complete_task",
      description: "Mark a task as done by searching for it by title",
      parameters: {
        type: "object",
        properties: {
          title_query: { type: "string", description: "Partial task title to search for" },
        },
        required: ["title_query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_event",
      description: "Schedule a calendar event or meeting",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Event title" },
          start_at: { type: "string", description: "ISO 8601 datetime, e.g. 2026-08-07T15:00:00" },
          end_at: { type: "string", description: "ISO 8601 datetime for end time" },
          description: { type: "string", description: "Optional event notes" },
          location: { type: "string", description: "Optional location or meeting link" },
        },
        required: ["title", "start_at"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_workspace",
      description: "Search notes and tasks in the workspace by keyword",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search keyword or phrase" },
          type: { type: "string", enum: ["notes", "tasks", "all"], description: "What to search (default: all)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "set_task_priority",
      description: "Change the priority of a task by searching for it by title",
      parameters: {
        type: "object",
        properties: {
          title_query: { type: "string", description: "Partial task title to search for" },
          priority: { type: "string", enum: ["none", "low", "medium", "high", "urgent"] },
        },
        required: ["title_query", "priority"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_project",
      description: "Create a new project in the workspace",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Project name" },
          description: { type: "string", description: "Optional project description" },
          color: { type: "string", description: "Optional hex color, e.g. #6366f1" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_today_summary",
      description: "Get a summary of today's tasks: due today, overdue, and in-progress",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "snooze_task",
      description: "Postpone a task by updating its due date",
      parameters: {
        type: "object",
        properties: {
          title_query: { type: "string", description: "Partial task title to search for" },
          due_date: { type: "string", description: "New ISO date, e.g. 2026-08-12 or 'next Monday'" },
        },
        required: ["title_query", "due_date"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "meeting_prep",
      description: "Prepare a standup or meeting brief: open tasks, recent notes, yesterday's completions",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
];

type ToolName =
  | "create_task"
  | "create_note"
  | "list_tasks"
  | "complete_task"
  | "create_event"
  | "search_workspace"
  | "set_task_priority"
  | "create_project"
  | "get_today_summary"
  | "snooze_task"
  | "meeting_prep";

interface ToolCall {
  id: string;
  function: { name: ToolName; arguments: string };
}

// ---------------------------------------------------------------------------
// Tool executors
// ---------------------------------------------------------------------------

type Supabase = NonNullable<Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>>;

interface ActionResult {
  tool: ToolName;
  success: boolean;
  summary: string;
}

interface RunToolContext {
  aiKey?: string;
  aiBase?: string;
}

async function execCreateTask(
  supabase: Supabase,
  workspaceId: string,
  args: { title: string; priority?: string; due_date?: string; status?: string }
): Promise<ActionResult> {
  const { error } = await supabase.from("tasks").insert({
    workspace_id: workspaceId,
    title: args.title,
    priority: (args.priority ?? "none") as TaskPriority,
    status: (args.status ?? "todo") as TaskStatus,
    due_date: args.due_date ?? null,
    position: Date.now(),
  });
  if (error) return { tool: "create_task", success: false, summary: `Failed to create task: ${error.message}` };
  return { tool: "create_task", success: true, summary: `Created task "${args.title}"` };
}

async function execCreateNote(
  supabase: Supabase,
  workspaceId: string,
  args: { title: string; content?: string },
  ctx?: RunToolContext
): Promise<ActionResult> {
  const { data: note, error } = await supabase
    .from("notes")
    .insert({ workspace_id: workspaceId, title: args.title, body_markdown: args.content ?? "" })
    .select("id")
    .single();
  if (error) return { tool: "create_note", success: false, summary: `Failed to create note: ${error.message}` };

  // Auto-tag: extract topics via AI and link them to the note
  if (ctx?.aiKey && note?.id) {
    try {
      const tagRes = await fetch(`${ctx.aiBase ?? "https://api.openai.com/v1"}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.aiKey}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{
            role: "user",
            content: `Extract 2-3 concise topic tags for this note. Title: "${args.title}". Content: "${(args.content ?? "").slice(0, 300)}". Return ONLY a JSON array of lowercase strings, e.g. ["auth","api"]. No other text.`,
          }],
          max_tokens: 60,
          temperature: 0,
        }),
      });
      if (tagRes.ok) {
        const tagJson = (await tagRes.json()) as { choices?: { message?: { content?: string } }[] };
        const raw = tagJson.choices?.[0]?.message?.content?.trim() ?? "[]";
        const tagNames: string[] = JSON.parse(raw);
        if (Array.isArray(tagNames) && tagNames.length > 0) {
          const trimmed = [...new Set(tagNames.map((t) => t.trim().toLowerCase()).filter(Boolean))];
          const { data: existing } = await supabase
            .from("tags")
            .select("id, name")
            .eq("workspace_id", workspaceId)
            .in("name", trimmed);
          const existingMap = new Map((existing ?? []).map((t: { id: string; name: string }) => [t.name, t.id]));
          const toCreate = trimmed.filter((n) => !existingMap.has(n)).map((n) => ({ workspace_id: workspaceId, name: n }));
          if (toCreate.length) {
            const { data: created } = await supabase.from("tags").insert(toCreate).select("id, name");
            for (const t of created ?? []) existingMap.set((t as { id: string; name: string }).name, (t as { id: string; name: string }).id);
          }
          const tagIds = trimmed.map((n) => existingMap.get(n)).filter(Boolean) as string[];
          if (tagIds.length) {
            await supabase.from("note_tags").insert(tagIds.map((tag_id) => ({ note_id: note.id, tag_id })));
          }
        }
      }
    } catch { /* tagging is best-effort */ }
  }

  return { tool: "create_note", success: true, summary: `Created note "${args.title}"` };
}

async function execListTasks(
  supabase: Supabase,
  workspaceId: string,
  args: { status?: string; limit?: number }
): Promise<ActionResult> {
  let q = supabase
    .from("tasks")
    .select("title, status, priority, due_date")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("position", { ascending: true })
    .limit(args.limit ?? 8);
  if (args.status) q = q.eq("status", args.status);
  const { data, error } = await q;
  if (error) return { tool: "list_tasks", success: false, summary: `Failed to list tasks: ${error.message}` };
  if (!data?.length) return { tool: "list_tasks", success: true, summary: "No tasks found." };
  const list = data.map((t) => `- ${t.title} [${t.status}]${t.due_date ? ` due ${t.due_date}` : ""}`).join("\n");
  return { tool: "list_tasks", success: true, summary: list };
}

async function execCompleteTask(
  supabase: Supabase,
  workspaceId: string,
  args: { title_query: string }
): Promise<ActionResult> {
  const { data } = await supabase
    .from("tasks")
    .select("id, title")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .neq("status", "done")
    .ilike("title", `%${args.title_query}%`)
    .limit(1)
    .maybeSingle();
  if (!data) return { tool: "complete_task", success: false, summary: `No task found matching "${args.title_query}"` };
  await supabase
    .from("tasks")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", data.id);
  return { tool: "complete_task", success: true, summary: `Marked "${data.title}" as done` };
}

async function execSearchWorkspace(
  supabase: Supabase,
  workspaceId: string,
  args: { query: string; type?: string }
): Promise<ActionResult> {
  const searchType = args.type ?? "all";
  const results: string[] = [];

  if (searchType === "all" || searchType === "notes") {
    const { data } = await supabase
      .from("notes")
      .select("title")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .or(`title.ilike.%${args.query}%,body_markdown.ilike.%${args.query}%`)
      .limit(5);
    if (data?.length) {
      results.push(`Notes: ${data.map((n) => n.title).join(", ")}`);
    }
  }

  if (searchType === "all" || searchType === "tasks") {
    const { data } = await supabase
      .from("tasks")
      .select("title, status")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .ilike("title", `%${args.query}%`)
      .limit(5);
    if (data?.length) {
      results.push(`Tasks: ${data.map((t) => `${t.title} [${t.status}]`).join(", ")}`);
    }
  }

  if (!results.length) return { tool: "search_workspace", success: true, summary: `No results found for "${args.query}"` };
  return { tool: "search_workspace", success: true, summary: results.join(" | ") };
}

async function execSetTaskPriority(
  supabase: Supabase,
  workspaceId: string,
  args: { title_query: string; priority: string }
): Promise<ActionResult> {
  const { data } = await supabase
    .from("tasks")
    .select("id, title")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .ilike("title", `%${args.title_query}%`)
    .limit(1)
    .maybeSingle();
  if (!data) return { tool: "set_task_priority", success: false, summary: `No task found matching "${args.title_query}"` };
  await supabase.from("tasks").update({ priority: args.priority as TaskPriority }).eq("id", data.id);
  return { tool: "set_task_priority", success: true, summary: `Set "${data.title}" priority to ${args.priority}` };
}

async function execCreateProject(
  supabase: Supabase,
  workspaceId: string,
  args: { name: string; description?: string; color?: string }
): Promise<ActionResult> {
  const { error } = await supabase.from("projects").insert({
    workspace_id: workspaceId,
    name: args.name,
    description: args.description ?? null,
    color: args.color ?? null,
    status: "active",
  });
  if (error) return { tool: "create_project", success: false, summary: `Failed to create project: ${error.message}` };
  return { tool: "create_project", success: true, summary: `Created project "${args.name}"` };
}

async function execGetTodaySummary(
  supabase: Supabase,
  workspaceId: string
): Promise<ActionResult> {
  const today = new Date().toISOString().slice(0, 10);

  const { data: dueToday } = await supabase
    .from("tasks")
    .select("title, status, priority")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .eq("due_date", today)
    .neq("status", "done")
    .order("priority", { ascending: false })
    .limit(8);

  const { data: overdue } = await supabase
    .from("tasks")
    .select("title, due_date")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .lt("due_date", today)
    .neq("status", "done")
    .limit(5);

  const { data: inProgress } = await supabase
    .from("tasks")
    .select("title")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .eq("status", "in_progress")
    .limit(5);

  const parts: string[] = [];
  if (inProgress?.length) parts.push(`In progress: ${inProgress.map((t) => t.title).join(", ")}`);
  if (dueToday?.length) parts.push(`Due today: ${dueToday.map((t) => t.title).join(", ")}`);
  if (overdue?.length) parts.push(`Overdue: ${overdue.map((t) => t.title).join(", ")}`);
  if (!parts.length) parts.push("No open tasks due today — clear schedule!");

  return { tool: "get_today_summary", success: true, summary: parts.join(". ") };
}

async function execSnoozeTask(
  supabase: Supabase,
  workspaceId: string,
  args: { title_query: string; due_date: string }
): Promise<ActionResult> {
  const { data } = await supabase
    .from("tasks")
    .select("id, title")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .ilike("title", `%${args.title_query}%`)
    .limit(1)
    .maybeSingle();
  if (!data) return { tool: "snooze_task", success: false, summary: `No task found matching "${args.title_query}"` };
  const isoDate = args.due_date.slice(0, 10);
  await supabase.from("tasks").update({ due_date: isoDate }).eq("id", data.id);
  return { tool: "snooze_task", success: true, summary: `Snoozed "${data.title}" to ${isoDate}` };
}

async function execCreateEvent(
  supabase: Supabase,
  workspaceId: string,
  args: { title: string; start_at: string; end_at?: string; description?: string; location?: string }
): Promise<ActionResult> {
  // Calendar in this app is task-based — events are tasks with a due_date.
  // Store time + location in description so it appears on the calendar.
  const date = args.start_at.slice(0, 10); // ISO date part
  const timeInfo = [
    args.start_at.length > 10 ? `Time: ${args.start_at.slice(11, 16)}` : null,
    args.end_at ? `– ${args.end_at.slice(11, 16)}` : null,
    args.location ? `📍 ${args.location}` : null,
    args.description ?? null,
  ].filter(Boolean).join("\n");

  const { error } = await supabase.from("tasks").insert({
    workspace_id: workspaceId,
    title: args.title,
    status: "todo" as TaskStatus,
    priority: "none" as TaskPriority,
    due_date: date,
    description: timeInfo || null,
    position: Date.now(),
  });
  if (error) return { tool: "create_event", success: false, summary: `Failed to schedule event: ${error.message}` };
  return { tool: "create_event", success: true, summary: `Scheduled "${args.title}" on ${date}${args.start_at.length > 10 ? ` at ${args.start_at.slice(11, 16)}` : ""}` };
}

async function execMeetingPrep(
  supabase: Supabase,
  workspaceId: string
): Promise<ActionResult> {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString();

  const [{ data: inProgress }, { data: highPrio }, { data: recentNotes }, { data: doneYesterday }] =
    await Promise.all([
      supabase.from("tasks").select("title").eq("workspace_id", workspaceId).is("deleted_at", null)
        .eq("status", "in_progress").limit(5),
      supabase.from("tasks").select("title, priority").eq("workspace_id", workspaceId).is("deleted_at", null)
        .eq("status", "todo").in("priority", ["high", "urgent"]).limit(5),
      supabase.from("notes").select("title").eq("workspace_id", workspaceId).is("deleted_at", null)
        .gte("created_at", threeDaysAgo).order("created_at", { ascending: false }).limit(5),
      supabase.from("tasks").select("title").eq("workspace_id", workspaceId).is("deleted_at", null)
        .eq("status", "done").gte("completed_at", yesterday).lt("completed_at", today).limit(5),
    ]);

  const parts: string[] = [];
  if (doneYesterday?.length) parts.push(`Done yesterday: ${doneYesterday.map((t) => t.title).join(", ")}`);
  if (inProgress?.length) parts.push(`In progress: ${inProgress.map((t) => t.title).join(", ")}`);
  if (highPrio?.length) parts.push(`Up next (high priority): ${highPrio.map((t) => t.title).join(", ")}`);
  if (recentNotes?.length) parts.push(`Recent notes: ${recentNotes.map((n) => n.title).join(", ")}`);
  if (!parts.length) parts.push("No recent activity found.");

  return { tool: "meeting_prep", success: true, summary: parts.join(". ") };
}

async function runTool(
  supabase: Supabase,
  workspaceId: string,
  name: ToolName,
  argsJson: string,
  ctx?: RunToolContext
): Promise<ActionResult> {
  const args = JSON.parse(argsJson) as Record<string, unknown>;
  switch (name) {
    case "create_task":       return execCreateTask(supabase, workspaceId, args as Parameters<typeof execCreateTask>[2]);
    case "create_note":       return execCreateNote(supabase, workspaceId, args as Parameters<typeof execCreateNote>[2], ctx);
    case "list_tasks":        return execListTasks(supabase, workspaceId, args as Parameters<typeof execListTasks>[2]);
    case "complete_task":     return execCompleteTask(supabase, workspaceId, args as Parameters<typeof execCompleteTask>[2]);
    case "create_event":      return execCreateEvent(supabase, workspaceId, args as Parameters<typeof execCreateEvent>[2]);
    case "search_workspace":  return execSearchWorkspace(supabase, workspaceId, args as Parameters<typeof execSearchWorkspace>[2]);
    case "set_task_priority": return execSetTaskPriority(supabase, workspaceId, args as Parameters<typeof execSetTaskPriority>[2]);
    case "create_project":    return execCreateProject(supabase, workspaceId, args as Parameters<typeof execCreateProject>[2]);
    case "get_today_summary": return execGetTodaySummary(supabase, workspaceId);
    case "snooze_task":       return execSnoozeTask(supabase, workspaceId, args as Parameters<typeof execSnoozeTask>[2]);
    case "meeting_prep":      return execMeetingPrep(supabase, workspaceId);
  }
}

// ---------------------------------------------------------------------------
// Agentic chat — multi-turn tool-calling loop (up to MAX_ITERATIONS rounds)
// ---------------------------------------------------------------------------

const MAX_AGENT_ITERATIONS = 5;

type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

async function agentChat(
  transcript: string,
  supabase: Supabase,
  workspaceId: string
): Promise<{ answer: string; actions: ActionResult[] }> {
  const key = getAiApiKey() ?? process.env.OPENAI_API_KEY;
  const base = getAiBaseUrl() ?? "https://api.openai.com/v1";
  if (!key) return { answer: "", actions: [] };

  const ctx: RunToolContext = { aiKey: key, aiBase: base };
  const today = new Date().toISOString().slice(0, 10);
  const systemPrompt = `You are an agentic AI assistant embedded in EngineerOS, a developer productivity workspace. Today is ${today}.
Call tools to act on behalf of the user (create tasks, notes, events, search, prep meetings, etc.).
Chain multiple tool calls when needed — for example, "plan my week" should list tasks then create events.
When done acting, respond conversationally in 1-2 plain-text sentences (no markdown) suitable for text-to-speech.`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: transcript },
  ];
  const allActions: ActionResult[] = [];

  for (let i = 0; i < MAX_AGENT_ITERATIONS; i++) {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        tools: TOOLS,
        tool_choice: "auto",
        max_tokens: i === MAX_AGENT_ITERATIONS - 1 ? 200 : 512,
        temperature: 0.4,
      }),
    });

    if (!res.ok) break;

    const json = (await res.json()) as {
      choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[];
    };
    const msg = json.choices?.[0]?.message;
    if (!msg) break;

    const toolCalls = msg.tool_calls ?? [];

    if (toolCalls.length === 0) {
      // Model gave a final answer — return it
      return {
        answer: msg.content?.trim() ?? allActions.map((a) => a.summary).join(". "),
        actions: allActions,
      };
    }

    // Append assistant message with tool_calls, execute tools, append results
    messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: toolCalls });

    for (const tc of toolCalls) {
      const result = await runTool(supabase, workspaceId, tc.function.name as ToolName, tc.function.arguments, ctx);
      allActions.push(result);
      messages.push({ role: "tool", tool_call_id: tc.id, content: result.summary });
    }
  }

  // Exhausted iterations — summarise actions as spoken confirmation
  return { answer: allActions.map((a) => a.summary).join(". ") || "", actions: allActions };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null);
  const audioFile = formData?.get("audio");
  if (!audioFile || !(audioFile instanceof Blob)) {
    return NextResponse.json({ error: "missing audio blob" }, { status: 400 });
  }

  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  const arrayBuffer = await audioFile.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const mime = audioFile.type || "audio/webm";

  try {
    const aiConfig = await loadAiConfig(supabase, workspace.id);
    return await runWithAiConfig(aiConfig, async () => {
      // 1. Transcribe
      const transcribeResult = await transcribeAudio(buffer, "voice.webm", mime);
      const transcript = transcribeResult?.transcript?.trim() ?? null;
      if (!transcript) {
        return NextResponse.json({ error: "transcription-failed", transcript: null }, { status: 502 });
      }

      // 2. Try agentic path first (needs OpenAI key + tool-calling)
      const { answer: agentAnswer, actions } = await agentChat(transcript, supabase, workspace.id);

      if (agentAnswer) {
        return NextResponse.json({ transcript, answer: agentAnswer, actions, sources: [] });
      }

      // 3. Fallback to RAG Q&A for non-OpenAI providers
      const qa = await answerWorkspaceQuestion(supabase, workspace.id, transcript);
      let chunks = qa.chunks;
      const localFallback = qa.summary;
      if (!qa.handled) {
        await drainIndexQueue(supabase, workspace.id, 10);
        chunks = await retrieveWorkspace(supabase, workspace.id, transcript);
      }
      const result = await answerWithContext(transcript, chunks, [], localFallback ?? undefined);

      return NextResponse.json({
        transcript,
        answer: result.answer,
        actions: [],
        sources: result.sources as ChatSource[],
        model: result.model,
        local: result.local,
      });
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
