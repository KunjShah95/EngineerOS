// Workspace Q&A — structured intent routing for the assistant.
//
// The RAG path (rag.ts) can only answer questions whose answer lives in the
// *text* of notes/tasks/resources/daily-notes/PDFs. Analytical questions like
// "What did I do last week?" or "Summarize my open tasks" retrieve nothing,
// because no document contains those words. This module intercepts those
// questions before retrieval, pattern-matches the intent, queries the
// *structured* rows directly (daily notes by date window, tasks by status,
// projects, meetings), and shapes the results into RagChunk[] + a plain-text
// summary. The route feeds the chunks through answerWithContext (LLM with
// citations) and uses the summary as the answer in local/no-API-key mode.

import type { RagChunk } from "./rag";
import { resourceHref } from "@/lib/resource-kind";

type Supabase = NonNullable<Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>>;

export type WorkspaceIntent =
  | "open_tasks"
  | "recent_activity"
  | "completed_tasks"
  | "due_tasks"
  | "project_summary"
  | "workspace_overview"
  | "follow_up";

export interface TimeWindow {
  start: Date;
  end: Date;
  label: string;
}

export interface WorkspaceQaResult {
  /** True when an intent matched and structured chunks/summary were produced. */
  handled: boolean;
  intent: WorkspaceIntent | null;
  chunks: RagChunk[];
  /** Pre-rendered answer, used in local/no-LLM mode and for empty contexts. */
  summary: string | null;
}

// ---------------------------------------------------------------------------
// Date helpers (local-time based, mirrors the date-only daily_notes column).
// ---------------------------------------------------------------------------

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function mondayOf(d: Date): Date {
  const x = startOfDay(d);
  const offset = (x.getDay() + 6) % 7; // Mon=0 .. Sun=6
  x.setDate(x.getDate() - offset);
  return x;
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested without a database).
// ---------------------------------------------------------------------------

export function parseTimeWindow(question: string, now: Date = new Date()): TimeWindow | null {
  const q = question.toLowerCase();

  // "...last/past/previous N days/weeks/months"
  const rel = q.match(/(?:last|past|previous)\s+(\d+)\s+(day|week|month)s?\b/i);
  if (rel) {
    const n = Number(rel[1]);
    const unit = rel[2].toLowerCase();
    let start: Date;
    if (unit === "day") start = startOfDay(addDays(now, -(n - 1)));
    else if (unit === "week") start = mondayOf(addDays(now, -7 * (n - 1)));
    else start = new Date(now.getFullYear(), now.getMonth() - (n - 1), 1);
    return { start, end: now, label: `last ${n} ${unit}${n > 1 ? "s" : ""}` };
  }

  if (/\byesterday\b/.test(q)) {
    const y = addDays(now, -1);
    return { start: startOfDay(y), end: endOfDay(y), label: "yesterday" };
  }
  if (/\btoday\b/.test(q)) {
    return { start: startOfDay(now), end: now, label: "today" };
  }
  if (/(?:this|current)\s+week\b/.test(q)) {
    return { start: mondayOf(now), end: now, label: "this week" };
  }
  if (/(?:last|previous|past|this)\s+weekend\b/.test(q)) {
    const monday = mondayOf(now);
    return { start: startOfDay(addDays(monday, -2)), end: endOfDay(addDays(monday, -1)), label: "the last weekend" };
  }
  if (/(?:last|previous|past)\s+week\b/.test(q)) {
    const monday = mondayOf(now);
    return { start: addDays(monday, -7), end: endOfDay(addDays(monday, -1)), label: "last week" };
  }
  if (/(?:this|current)\s+month\b/.test(q)) {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now, label: "this month" };
  }
  if (/(?:last|previous|past)\s+month\b/.test(q)) {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { start, end, label: "last month" };
  }
  if (/(?:this|current)\s+year\b/.test(q)) {
    return { start: new Date(now.getFullYear(), 0, 1), end: now, label: "this year" };
  }
  if (/(?:last|previous|past)\s+year\b/.test(q)) {
    const start = new Date(now.getFullYear() - 1, 0, 1);
    const end = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
    return { start, end, label: "last year" };
  }
  if (/\bfew\s+days\b/.test(q)) {
    return { start: startOfDay(addDays(now, -2)), end: now, label: "the last few days" };
  }
  if (/\brecent(?:ly)?\b/.test(q)) {
    return { start: startOfDay(addDays(now, -13)), end: now, label: "recently (last 14 days)" };
  }
  return null;
}

const INTENT_GROUPS: { intent: WorkspaceIntent; patterns: RegExp[] }[] = [
  {
    intent: "open_tasks",
    patterns: [
      /(open|pending|outstanding|active|unfinished|incomplete)\s+tasks?/i,
      /tasks?\s+that\s+are\s+(still\s+)?(open|pending|outstanding|active|unfinished)/i,
      /(summarize|summary|list)\s+(of\s+)?(my\s+)?(open|pending|outstanding|active|unfinished)?\s*tasks?/i,
      /(what|what'?s|whats)\s+.*(need|have|still|should)\s+to\s+(do|work\s+on)/i,
      /what('s| is|s)\s+on\s+my\s+(plate|list)/i,
      /(my|open|pending|remaining)\s+(todo|to-?do)/i,
      /(what|which)\s+tasks?\s+are\s+(pending|open|active|not\s+done|outstanding)/i,
    ],
  },
  {
    intent: "completed_tasks",
    patterns: [
      /(complete|completed|done|finished|finish|accomplish|accomplished)\s+(tasks?|items?|work)/i,
      /what\s+(have|did)\s+i\s+(complete|completed|finished|accomplish)/i,
      /(tasks?|items?|work)\s+(i|that)\s+(completed|finished|did)/i,
    ],
  },
  {
    intent: "due_tasks",
    patterns: [
      /(due|deadline|deadlines|overdue)\b/i,
    ],
  },
  {
    intent: "project_summary",
    patterns: [
      /(summarize|summary|overview|status|progress)\s+(of\s+)?(my\s+)?projects?/i,
      /projects?\s+(status|overview|progress|summary)/i,
      /\bprojects?\b.*\b(going|doing|progress|status|overview)\b/i,
      /\b(progress|status|overview|summary)\b.*\bprojects?\b/i,
    ],
  },
  {
    intent: "workspace_overview",
    patterns: [
      /(summarize|summary|overview|stats|statistics)\s+(my\s+)?(workspace|everything|notes?|tasks?|projects?)/i,
      /how\s+many\s+(notes?|tasks?|projects?|resources?|pdfs?|daily\s+notes?)/i,
    ],
  },
  {
    intent: "follow_up",
    patterns: [
      /(meetings?|decisions?|action\s+items?)\s+.*\b(follow\s?up|review|todo|to-?do)\b/i,
      /(any|open|pending)\s+(follow[- ]?ups?|action\s+items?)/i,
      /what\s+should\s+i\s+follow\s+up\s+on/i,
      /(should|need)\s+.*follow\s+up\s+on/i,
    ],
  },
];

// Activity verbs that signal "what did I do" style questions. Deliberately
// excludes bare "do"/"work" so a document question like "what do my notes say
// about X?" is not mistaken for recent activity.
const ACTIVITY_VERB = /(did|done|worked\s+on|been\s+up\s+to|accomplish|accomplished|completed|created|wrote|written|made|shipped|achiev|learned|recap)/i;

export function detectIntent(
  question: string,
  now?: Date
): { intent: WorkspaceIntent; window: TimeWindow | null } | null {
  for (const group of INTENT_GROUPS) {
    if (group.patterns.some((p) => p.test(question))) {
      return { intent: group.intent, window: parseTimeWindow(question, now) };
    }
  }

  // recent_activity needs BOTH an explicit activity verb and a time signal so
  // it doesn't hijack ordinary retrieval questions.
  const window = parseTimeWindow(question, now);
  const hasActivity = ACTIVITY_VERB.test(question);
  const hasTimeSignal =
    window !== null || /\b(today|yesterday|this\s+week|this\s+month|recent|recently|last\s+week)\b/i.test(question);
  if (hasActivity && hasTimeSignal) {
    return { intent: "recent_activity", window };
  }

  return null;
}

function windowOrDefault(w: TimeWindow | null, now: Date, days = 7): TimeWindow {
  if (w) return w;
  return { start: addDays(now, -days), end: now, label: `last ${days} days` };
}

// ---------------------------------------------------------------------------
// Chunk builders (shared by the query handlers).
// ---------------------------------------------------------------------------

export interface RenderTask {
  title: string;
  status?: string | null;
  priority?: string | null;
  due_date?: string | null;
  completed_at?: string | null;
  description?: string | null;
}

type TaskChunkInput = RenderTask & { id: string };

function taskMeta(t: RenderTask): string {
  const parts: string[] = [`status: ${t.status ?? "unknown"}`];
  if (t.priority && t.priority !== "none") parts.push(`priority: ${t.priority}`);
  if (t.due_date) parts.push(`due: ${t.due_date}`);
  if ((t.status === "done" || t.completed_at) && t.completed_at) parts.push(`completed: ${t.completed_at.slice(0, 10)}`);
  return parts.join(", ");
}

function taskChunk(t: TaskChunkInput): RagChunk {
  const line = `[task] ${t.title} (${taskMeta(t)})`;
  const content = t.description ? `${line}\n${t.description}` : line;
  return {
    content,
    source: { entity_type: "task", entity_id: t.id, title: t.title, href: `/tasks?task=${t.id}`, score: 1 },
  };
}

export interface RenderDaily {
  id?: string;
  date: string;
  morning_goals?: string | null;
  journal?: string | null;
  learned?: string | null;
  wins?: string | null;
  problems?: string | null;
  tomorrow?: string | null;
}

function dailySections(d: RenderDaily): string {
  const parts: string[] = [`[daily note ${d.date}]`];
  if (d.morning_goals) parts.push(`Morning goals: ${d.morning_goals}`);
  if (d.journal) parts.push(`Journal: ${d.journal}`);
  if (d.learned) parts.push(`Learned: ${d.learned}`);
  if (d.wins) parts.push(`Wins: ${d.wins}`);
  if (d.problems) parts.push(`Problems: ${d.problems}`);
  if (d.tomorrow) parts.push(`Tomorrow: ${d.tomorrow}`);
  return parts.join("\n");
}

function dailyChunk(d: RenderDaily & { id: string }): RagChunk {
  return {
    content: dailySections(d),
    source: { entity_type: "daily_note", entity_id: d.id, title: `Daily Note ${d.date}`, href: `/daily/${d.date}`, score: 1 },
  };
}

export interface RenderProject {
  id?: string;
  name: string;
  status?: string | null;
  description?: string | null;
  open?: number;
  done?: number;
}

function projectChunk(p: RenderProject & { id: string }): RagChunk {
  const lines = [
    `[project] ${p.name} (status: ${p.status ?? "active"})`,
    p.description ? p.description : null,
    `open tasks: ${p.open ?? 0}, completed: ${p.done ?? 0}`,
  ]
    .filter((x): x is string => Boolean(x))
    .join("\n");
  return {
    content: lines,
    source: { entity_type: "project", entity_id: p.id, title: p.name, href: `/projects/${p.id}`, score: 1 },
  };
}

function meetingChunk(m: { id: string; title: string; body_markdown?: string | null; metadata?: unknown }): RagChunk {
  const meta = (m.metadata ?? {}) as { meeting_date?: string | null };
  const date = meta.meeting_date ? ` (${meta.meeting_date})` : "";
  const content = `[meeting] ${m.title}${date}\n${m.body_markdown ?? ""}`;
  return {
    content: content.slice(0, 1400),
    source: { entity_type: "resource", entity_id: m.id, title: m.title, href: resourceHref("meeting", m.id), score: 1 },
  };
}

// ---------------------------------------------------------------------------
// Plain-text summary renderers (used in local/no-LLM mode; pure for testing).
// ---------------------------------------------------------------------------

export function renderOpenTasks(active: RenderTask[], backlog: RenderTask[]): string {
  if (active.length === 0 && backlog.length === 0) {
    return "You have no open tasks right now — either everything is wrapped up or nothing has been captured yet.";
  }
  const lines: string[] = [`You have ${active.length} open task${active.length === 1 ? "" : "s"}:`];
  active.forEach((t, i) => {
    const pri = t.priority && t.priority !== "none" ? ` [${t.priority}]` : "";
    const due = t.due_date ? ` (due ${t.due_date})` : "";
    lines.push(`${i + 1}.${pri} ${t.title}${due}`);
  });
  if (backlog.length > 0) {
    lines.push("", `Plus ${backlog.length} in backlog:`);
    backlog.forEach((t, i) => lines.push(`${i + 1}. ${t.title}`));
  }
  return lines.join("\n");
}

export function renderRecentActivity(
  label: string,
  startYmd: string,
  endYmd: string,
  dailies: RenderDaily[],
  completed: RenderTask[],
  created: RenderTask[]
): string {
  const out: string[] = [`Here's what I found for ${label} (${startYmd} → ${endYmd}):`];

  if (dailies.length > 0) {
    out.push("", "Daily notes:");
    for (const d of dailies) {
      const snippets = [
        d.morning_goals ? `Goals: ${d.morning_goals}` : null,
        d.wins ? `Wins: ${d.wins}` : null,
        d.learned ? `Learned: ${d.learned}` : null,
        d.problems ? `Problems: ${d.problems}` : null,
        d.journal,
      ]
        .filter((x): x is string => Boolean(x))
        .map((s) => truncate(s, 160))
        .slice(0, 2)
        .join(" | ");
      out.push(`- ${d.date}${snippets ? ` — ${snippets}` : ""}`);
    }
  } else {
    out.push("", "No daily notes in this period.");
  }

  if (completed.length > 0) {
    out.push("", `Tasks completed (${completed.length}):`);
    for (const t of completed) {
      out.push(`- ${t.title}${t.completed_at ? ` (${t.completed_at.slice(0, 10)})` : ""}`);
    }
  } else {
    out.push("", "No tasks completed in this period.");
  }

  if (created.length > 0) {
    out.push("", `Tasks created (${created.length}):`);
    for (const t of created) out.push(`- ${t.title}`);
  }

  return out.join("\n");
}

export function renderCompleted(label: string, done: RenderTask[]): string {
  if (done.length === 0) return `No tasks completed ${label}.`;
  const lines: string[] = [`Tasks completed ${label} (${done.length}):`];
  for (const t of done) {
    lines.push(`- ${t.title}${t.completed_at ? ` (${t.completed_at.slice(0, 10)})` : ""}`);
  }
  return lines.join("\n");
}

export function renderDue(overdue: RenderTask[], upcoming: RenderTask[], soonYmd: string): string {
  const out: string[] = [];
  if (overdue.length > 0) {
    out.push(`${overdue.length} overdue task${overdue.length === 1 ? "" : "s"}:`);
    overdue.forEach((t) => out.push(`- [overdue] ${t.title} (was due ${t.due_date})`));
  } else {
    out.push("No overdue tasks.");
  }
  if (upcoming.length > 0) {
    out.push("", `Due in the next 7 days (by ${soonYmd}):`);
    upcoming.forEach((t) => out.push(`- ${t.title} (due ${t.due_date})`));
  } else {
    out.push("", `Nothing due in the next 7 days (by ${soonYmd}).`);
  }
  return out.join("\n");
}

export function renderProjects(projects: RenderProject[]): string {
  if (projects.length === 0) return "You have no projects yet.";
  const out: string[] = [`You have ${projects.length} project${projects.length === 1 ? "" : "s"}:`];
  for (const p of projects) {
    out.push(
      `- ${p.name} (${p.status ?? "active"}) — ${p.open ?? 0} open, ${p.done ?? 0} done${p.description ? ` — ${truncate(p.description, 120)}` : ""}`
    );
  }
  return out.join("\n");
}

export interface WorkspaceCounts {
  notes: number;
  tasksTotal: number;
  todo: number;
  inProgress: number;
  done: number;
  projects: number;
  resources: number;
  pdfs: number;
  dailies: number;
}

export function renderOverview(c: WorkspaceCounts): string {
  return [
    "Your workspace at a glance:",
    `- Notes: ${c.notes}`,
    `- Tasks: ${c.tasksTotal} total — ${c.inProgress} in progress, ${c.todo} to do, ${c.done} done`,
    `- Projects: ${c.projects}`,
    `- Resources: ${c.resources}`,
    `- PDFs: ${c.pdfs}`,
    `- Daily notes: ${c.dailies}`,
  ].join("\n");
}

export function renderFollowUp(
  meetings: { title: string }[],
  tomorrows: RenderDaily[],
  openTasks: RenderTask[]
): string {
  if (meetings.length === 0 && tomorrows.length === 0 && openTasks.length === 0) {
    return "Nothing pressing to follow up on right now.";
  }
  const out: string[] = [];
  if (meetings.length > 0) {
    out.push(`Recent meetings worth reviewing (${meetings.length}):`);
    meetings.forEach((m) => out.push(`- ${m.title}`));
  }
  if (tomorrows.length > 0) {
    out.push("", "From your daily notes (\"tomorrow\" sections):");
    tomorrows.forEach((d) => out.push(`- ${d.date}: ${truncate(d.tomorrow ?? "", 180)}`));
  }
  if (openTasks.length > 0) {
    out.push("", `Open tasks to follow up on (${openTasks.length}):`);
    openTasks.slice(0, 10).forEach((t) => out.push(`- ${t.title}${t.due_date ? ` (due ${t.due_date})` : ""}`));
  }
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// Database-backed query handlers.
// ---------------------------------------------------------------------------

async function queryOpenTasks(supabase: Supabase, workspaceId: string): Promise<WorkspaceQaResult> {
  const { data } = await supabase
    .from("tasks")
    .select("id, title, description, status, priority, due_date, completed_at")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .in("status", ["backlog", "todo", "in_progress"])
    .order("position", { ascending: true })
    .limit(60);

  const list = (data ?? []) as TaskChunkInput[];
  const active = list.filter((t) => t.status !== "backlog");
  const backlog = list.filter((t) => t.status === "backlog");

  return {
    handled: true,
    intent: "open_tasks",
    chunks: list.map(taskChunk),
    summary: renderOpenTasks(active, backlog),
  };
}

async function queryRecentActivity(
  supabase: Supabase,
  workspaceId: string,
  window: TimeWindow | null,
  now: Date
): Promise<WorkspaceQaResult> {
  const win = windowOrDefault(window, now, 7);
  const startIso = win.start.toISOString();
  const endIso = win.end.toISOString();
  const startYmd = toYmd(win.start);
  const endYmd = toYmd(win.end);

  const [dailiesRes, completedRes, createdRes] = await Promise.all([
    supabase
      .from("daily_notes")
      .select("id, date, morning_goals, journal, learned, wins, problems, tomorrow")
      .eq("workspace_id", workspaceId)
      .gte("date", startYmd)
      .lte("date", endYmd)
      .order("date", { ascending: true })
      .limit(31),
    supabase
      .from("tasks")
      .select("id, title, description, status, priority, due_date, completed_at")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .gte("completed_at", startIso)
      .lte("completed_at", endIso)
      .order("completed_at", { ascending: true })
      .limit(40),
    supabase
      .from("tasks")
      .select("id, title, description, status, priority, due_date, created_at")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .gte("created_at", startIso)
      .lte("created_at", endIso)
      .order("created_at", { ascending: true })
      .limit(40),
  ]);

  const dailies = (dailiesRes.data ?? []) as (RenderDaily & { id: string })[];
  const completed = (completedRes.data ?? []) as TaskChunkInput[];
  const created = (createdRes.data ?? []) as TaskChunkInput[];

  const chunks: RagChunk[] = [
    ...dailies.map(dailyChunk),
    ...completed.map(taskChunk),
    ...created.map(taskChunk),
  ];

  return {
    handled: true,
    intent: "recent_activity",
    chunks,
    summary: renderRecentActivity(win.label, startYmd, endYmd, dailies, completed, created),
  };
}

async function queryCompletedTasks(
  supabase: Supabase,
  workspaceId: string,
  window: TimeWindow | null,
  now: Date
): Promise<WorkspaceQaResult> {
  const win = windowOrDefault(window, now, 7);
  const { data } = await supabase
    .from("tasks")
    .select("id, title, description, status, priority, due_date, completed_at")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .eq("status", "done")
    .gte("completed_at", win.start.toISOString())
    .lte("completed_at", win.end.toISOString())
    .order("completed_at", { ascending: true })
    .limit(50);

  const done = (data ?? []) as TaskChunkInput[];
  return {
    handled: true,
    intent: "completed_tasks",
    chunks: done.map(taskChunk),
    summary: renderCompleted(win.label, done),
  };
}

async function queryDueTasks(supabase: Supabase, workspaceId: string, now: Date): Promise<WorkspaceQaResult> {
  const todayYmd = toYmd(now);
  const soonYmd = toYmd(addDays(now, 7));
  const [overdueRes, upcomingRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, description, status, priority, due_date, completed_at")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .not("status", "eq", "done")
      .lt("due_date", todayYmd)
      .order("due_date", { ascending: true })
      .limit(40),
    supabase
      .from("tasks")
      .select("id, title, description, status, priority, due_date, completed_at")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .not("status", "eq", "done")
      .gte("due_date", todayYmd)
      .lte("due_date", soonYmd)
      .order("due_date", { ascending: true })
      .limit(40),
  ]);

  const overdue = (overdueRes.data ?? []) as TaskChunkInput[];
  const upcoming = (upcomingRes.data ?? []) as TaskChunkInput[];
  return {
    handled: true,
    intent: "due_tasks",
    chunks: [...overdue, ...upcoming].map(taskChunk),
    summary: renderDue(overdue, upcoming, soonYmd),
  };
}

async function queryProjectSummary(supabase: Supabase, workspaceId: string): Promise<WorkspaceQaResult> {
  const [projectsRes, tasksRes] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, description, status, color")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(50),
    supabase.from("tasks").select("project_id, status").eq("workspace_id", workspaceId).is("deleted_at", null).limit(500),
  ]);

  const projects = (projectsRes.data ?? []) as (RenderProject & { id: string })[];
  const taskRows = (tasksRes.data ?? []) as { project_id: string | null; status: string }[];

  const stats = new Map<string, { open: number; done: number }>();
  for (const t of taskRows) {
    if (!t.project_id) continue;
    const s = stats.get(t.project_id) ?? { open: 0, done: 0 };
    if (t.status === "done") s.done += 1;
    else s.open += 1;
    stats.set(t.project_id, s);
  }

  const shaped = projects.map((p) => ({
    ...p,
    open: stats.get(p.id)?.open ?? 0,
    done: stats.get(p.id)?.done ?? 0,
  }));

  return {
    handled: true,
    intent: "project_summary",
    chunks: projects.map((p) => projectChunk(p)),
    summary: renderProjects(shaped),
  };
}

async function queryWorkspaceOverview(supabase: Supabase, workspaceId: string): Promise<WorkspaceQaResult> {
  const count = async (table: string, status?: string) => {
    let q = supabase
      .from(table as "tasks")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId);

    if (table !== "pdf_documents" && table !== "daily_notes") {
      q = q.is("deleted_at", null);
    }
    if (status) q = q.eq("status", status);

    const { count: c } = await q;
    return c ?? 0;
  };

  const [notes, tasksTotal, todo, inProgress, done, projects, resources, pdfs, dailies] = await Promise.all([
    count("notes"),
    count("tasks"),
    count("tasks", "todo"),
    count("tasks", "in_progress"),
    count("tasks", "done"),
    count("projects"),
    count("resources"),
    count("pdf_documents"),
    count("daily_notes"),
  ]);

  const counts: WorkspaceCounts = { notes, tasksTotal, todo, inProgress, done, projects, resources, pdfs, dailies };

  return {
    handled: true,
    intent: "workspace_overview",
    chunks: [],
    summary: renderOverview(counts),
  };
}

async function queryFollowUp(supabase: Supabase, workspaceId: string, now: Date): Promise<WorkspaceQaResult> {
  const since = addDays(now, -30);
  const [meetingsRes, tomorrowsRes, openRes] = await Promise.all([
    supabase
      .from("resources")
      .select("id, title, body_markdown, metadata, updated_at")
      .eq("workspace_id", workspaceId)
      .eq("kind", "meeting")
      .is("deleted_at", null)
      .gte("updated_at", since.toISOString())
      .order("updated_at", { ascending: false })
      .limit(20),
    supabase
      .from("daily_notes")
      .select("id, date, tomorrow")
      .eq("workspace_id", workspaceId)
      .gte("date", toYmd(addDays(now, -7)))
      .not("tomorrow", "is", null)
      .order("date", { ascending: false })
      .limit(10),
    supabase
      .from("tasks")
      .select("id, title, description, status, priority, due_date, completed_at")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .in("status", ["backlog", "todo", "in_progress"])
      .order("position", { ascending: true })
      .limit(20),
  ]);

  const meetings = (meetingsRes.data ?? []) as { id: string; title: string; body_markdown?: string | null; metadata?: unknown }[];
  const tomorrows = (tomorrowsRes.data ?? []) as (RenderDaily & { id: string })[];
  const openTasks = (openRes.data ?? []) as TaskChunkInput[];

  const chunks: RagChunk[] = [
    ...meetings.map(meetingChunk),
    ...tomorrows.map((d) => ({
      content: `[daily note ${d.date}] tomorrow:\n${d.tomorrow ?? ""}`,
      source: { entity_type: "daily_note" as const, entity_id: d.id, title: `Daily Note ${d.date}`, href: `/daily/${d.date}`, score: 1 },
    })),
    ...openTasks.map(taskChunk),
  ];

  return {
    handled: true,
    intent: "follow_up",
    chunks,
    summary: renderFollowUp(meetings, tomorrows, openTasks),
  };
}

// ---------------------------------------------------------------------------
// Entry point: try structured Q&A, else signal "not handled" (RAG fallback).
// ---------------------------------------------------------------------------

export async function answerWorkspaceQuestion(
  supabase: Supabase,
  workspaceId: string,
  question: string,
  now: Date = new Date()
): Promise<WorkspaceQaResult> {
  const detected = detectIntent(question, now);
  if (!detected) return { handled: false, intent: null, chunks: [], summary: null };

  switch (detected.intent) {
    case "open_tasks":
      return queryOpenTasks(supabase, workspaceId);
    case "recent_activity":
      return queryRecentActivity(supabase, workspaceId, detected.window, now);
    case "completed_tasks":
      return queryCompletedTasks(supabase, workspaceId, detected.window, now);
    case "due_tasks":
      return queryDueTasks(supabase, workspaceId, now);
    case "project_summary":
      return queryProjectSummary(supabase, workspaceId);
    case "workspace_overview":
      return queryWorkspaceOverview(supabase, workspaceId);
    case "follow_up":
      return queryFollowUp(supabase, workspaceId, now);
  }
}








