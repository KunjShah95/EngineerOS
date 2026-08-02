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

export type EmbeddingEntity = "note" | "task" | "resource" | "daily_note" | "pdf";

export interface SemanticMatch {
  entity_type: EmbeddingEntity;
  entity_id: string;
  chunk_index: number;
  content: string;
  score: number;
}
