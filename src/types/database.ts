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
