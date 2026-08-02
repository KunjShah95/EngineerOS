// EngineerOS database types.
// Hand-written to match supabase/migrations/20260802000001_init.sql.
// Regenerate with `supabase gen types typescript` once the project is linked.

export type ProjectStatus = "active" | "paused" | "archived";
export type TaskStatus = "backlog" | "todo" | "in_progress" | "done";
export type TaskPriority = "none" | "low" | "medium" | "high" | "urgent";
export type NoteStatus = "draft" | "active" | "archived";
export type CaptureType = "note" | "task";

export interface Workspace {
  id: string;
  owner_id: string;
  name: string;
  /** Where reminder + digest emails go (null = none — in-app feed only). */
  email: string | null;
  weekly_digest: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Profile {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  color: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Task {
  id: string;
  workspace_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  estimate: number | null;
  position: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  deleted_at: string | null;
  /** URL of the GitHub issue this task was imported from, if any. */
  source_url: string | null;
}

export interface Note {
  id: string;
  workspace_id: string;
  project_id: string | null;
  title: string;
  body_markdown: string;
  status: NoteStatus;
  pinned: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DailyNote {
  id: string;
  workspace_id: string;
  date: string;
  morning_goals: string | null;
  journal: string | null;
  learned: string | null;
  wins: string | null;
  problems: string | null;
  tomorrow: string | null;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  workspace_id: string;
  name: string;
  color: string | null;
}

export interface QuickCapture {
  id: string;
  workspace_id: string;
  raw_text: string;
  triaged_into: CaptureType | null;
  triaged_id: string | null;
  created_at: string;
}

/** Project with aggregate counts, from a related-count select. */
export interface ProjectWithCounts extends Project {
  tasks: { count: number }[];
  notes: { count: number }[];
}

/** Task with its project resolved for card rendering. */
export interface TaskWithProject extends Task {
  project: { id: string; name: string; color: string | null } | null;
}

/** Note with its project and tags resolved. */
export interface NoteWithRelations extends Note {
  project: { id: string; name: string; color: string | null } | null;
  note_tags: { tag: Tag }[];
}

export interface TagWithUsage extends Tag {
  notes: { count: number }[];
  tasks: { count: number }[];
}

// ---------------------------------------------------------------------------
// Group B — integrations, voice notes, AI summaries, PDF documents
// ---------------------------------------------------------------------------

export type IntegrationProvider = "github";

export interface Integration {
  id: string;
  workspace_id: string;
  provider: IntegrationProvider;
  provider_user_id: string;
  username: string | null;
  avatar_url: string | null;
  /** Server-side only — never sent to the client. */
  access_token: string;
  scopes: string[] | null;
  connected_at: string;
  updated_at: string;
}

export interface VoiceNote {
  id: string;
  workspace_id: string;
  note_id: string | null;
  storage_path: string;
  duration_ms: number;
  transcript: string | null;
  status: "recorded" | "transcribing" | "transcribed" | "failed";
  created_at: string;
}

export type SummaryEntityType = "note" | "task" | "daily_note";

export interface AiSummary {
  id: string;
  workspace_id: string;
  entity_type: SummaryEntityType;
  entity_id: string;
  summary: string;
  model: string;
  created_at: string;
}

export interface PdfDocument {
  id: string;
  workspace_id: string;
  project_id: string | null;
  title: string;
  storage_path: string | null;
  text_content: string;
  char_count: number;
  created_at: string;
}

export type ResourceKind = "code" | "bookmark" | "reading" | "architecture" | "meeting";
export type ReadingStatus = "want" | "reading" | "done";

export interface ResourceMetadata {
  url?: string;
  language?: string;
  read_status?: ReadingStatus;
  meeting_date?: string | null;
  attendees?: string[];
}

/** Resource row mapping to public.resources. */
export interface Resource {
  id: string;
  workspace_id: string;
  project_id: string | null;
  kind: ResourceKind;
  title: string;
  body_markdown: string;
  status: NoteStatus;
  pinned: boolean;
  metadata: ResourceMetadata;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Resource with project + tags resolved for card rendering. */
export interface ResourceWithRelations extends Resource {
  project: { id: string; name: string; color: string | null } | null;
  resource_tags: { tag: Tag }[];
}

// ---------------------------------------------------------------------------
// Phase 8a — semantic search (embeddings table + semantic_search RPC)
// ---------------------------------------------------------------------------

export type EmbeddingEntity = "note" | "task" | "resource" | "daily_note" | "pdf";

/** One ranked hit from the semantic_search RPC (or the local keyword scorer). */
export interface SemanticMatch {
  entity_type: EmbeddingEntity;
  entity_id: string;
  chunk_index: number;
  content: string;
  score: number;
  /** Resource kind (code/bookmark/reading/architecture/meeting) — for routing. */
  kind?: string | null;
  /** ISO date for daily_note hits — for routing to /daily/:date. */
  date?: string | null;
}

// ---------------------------------------------------------------------------
// Phase 8b — workspace Q&A / RAG assistant (chat_threads + chat_messages)
// ---------------------------------------------------------------------------

export type ChatRole = "user" | "assistant";

/** A cited source attached to an assistant chat message. */
export interface ChatSource {
  entity_type: EmbeddingEntity;
  entity_id: string;
  title: string;
  href: string;
  score: number;
}

export interface ChatThread {
  id: string;
  workspace_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ChatMessage {
  id: string;
  thread_id: string;
  role: ChatRole;
  content: string;
  sources: ChatSource[];
  model: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Phase 9 — Knowledge Graph (note_links + graph shapes)
// ---------------------------------------------------------------------------

/** Directed note→note link (note_id links TO linked_note_id). */
export interface NoteLink {
  note_id: string;
  linked_note_id: string;
  created_at: string;
}

/** Entity kinds the knowledge graph visualizes. */
export type GraphEntityKind = "note" | "task" | "resource";

/** One node in the graph. */
export interface GraphNode {
  id: string;
  kind: GraphEntityKind;
  label: string;
  href: string;
  /** Resource kind (code/bookmark/...) or task status or "note". */
  meta: string | null;
  /** Optional project color for node tinting. */
  color: string | null;
  /** Owning project (null = unfiled) — powers the project filter. */
  project_id: string | null;
}

/** Edge provenance — the graph legend explains each type. */
export type GraphEdgeKind = "task_note" | "note_link" | "wikilink";

export interface GraphEdge {
  source: string;
  target: string;
  kind: GraphEdgeKind;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ---------------------------------------------------------------------------
// Phase 10 — Automation (rules + background job queue)
// ---------------------------------------------------------------------------

export type AutomationRuleKind = "recurring_task" | "auto_triage" | "daily_rollover";

/** Recurring-task cadence. */
export type RecurringCadence =
  | { type: "daily" }
  | { type: "weekly"; weekday: number } // 0 = Sunday … 6 = Saturday
  | { type: "monthly"; day_of_month: number }; // 1–28 (28+ clamps to month end)

export interface RecurringTaskConfig {
  title: string;
  cadence: RecurringCadence;
  project_id?: string | null;
  priority?: TaskPriority;
  description?: string;
  /** Days after creation to set the due date (0 = due today). */
  due_offset_days?: number;
  /** Minutes after task creation to enqueue an in-app reminder job (0/omitted = none). */
  remind_after_minutes?: number;
}

/** Keyword match → entity type for auto-triage. */
export interface AutoTriageRule {
  match: string;
  action: "note" | "task";
  project_id?: string | null;
}

export interface AutomationRule {
  id: string;
  workspace_id: string;
  kind: AutomationRuleKind;
  name: string;
  config: RecurringTaskConfig | AutoTriageRule | Record<string, never>;
  enabled: boolean;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type AutomationJobKind = "auto_triage" | "reminder" | "digest";

export interface AutomationJob {
  id: string;
  workspace_id: string;
  kind: AutomationJobKind;
  status: "pending" | "running" | "done" | "failed";
  attempts: number;
  max_attempts: number;
  error: string | null;
  payload: Record<string, unknown>;
  run_at: string;
  created_at: string;
  updated_at: string;
}

/** In-app reminder materialized by the drain from a due reminder job. */
export interface ReminderRow {
  id: string;
  workspace_id: string;
  /** Source job — unique, so drain processing is idempotent. */
  job_id: string;
  rule_id: string | null;
  task_id: string | null;
  title: string;
  fire_at: string;
  read_at: string | null;
  created_at: string;
}


