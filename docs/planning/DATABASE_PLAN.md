# DATABASE_PLAN.md — EngineerOS

## Engine

PostgreSQL (via Supabase — see BACKEND_ROADMAP.md for rationale). UUID primary keys throughout, `created_at`/`updated_at` timestamps on every table, soft-delete via `deleted_at` nullable timestamp (nothing hard-deletes in V1 — needed later for Knowledge Graph history).

## Entity Relationship Diagram

```
users
  └─< workspaces (owner_id)
        ├─< projects (workspace_id)
        │     ├─< tasks (project_id, nullable)
        │     └─< notes (project_id, nullable)
        ├─< tasks (workspace_id, direct — standalone tasks)
        ├─< notes (workspace_id, direct — standalone notes)
        ├─< daily_notes (workspace_id)
        ├─< tags (workspace_id)
        └─< quick_captures (workspace_id) [ephemeral inbox, triaged into note/task]

tags >──< notes      (note_tags, many-to-many)
tags >──< tasks      (task_tags, many-to-many)
tasks >──< notes     (task_notes, many-to-many — "linked notes")
```

## Tables

### `users`
Managed by auth provider (Supabase Auth). App-level profile row:

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | = auth.users.id |
| email | text unique | |
| display_name | text | |
| avatar_url | text nullable | |
| created_at | timestamptz | |

### `workspaces`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| owner_id | uuid FK → users.id | |
| name | text | default "My Workspace" |
| created_at | timestamptz | |
| updated_at | timestamptz | |

V1: exactly one workspace per user, created at signup. Multi-workspace is explicitly Won't Have — schema supports it (owner_id is not unique) so it's not a rewrite later, but no UI for switching workspaces ships now.

### `projects`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| workspace_id | uuid FK → workspaces.id | |
| name | text | |
| description | text nullable | |
| status | enum('active','paused','archived') | default 'active' |
| color | text nullable | hex, for kanban/card accents |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| deleted_at | timestamptz nullable | |

### `tasks`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| workspace_id | uuid FK → workspaces.id | |
| project_id | uuid FK → projects.id, nullable | null = standalone task |
| title | text | |
| description | text nullable | markdown |
| status | enum('backlog','todo','in_progress','done') | drives kanban column |
| priority | enum('none','low','medium','high','urgent') | default 'none' |
| due_date | date nullable | |
| estimate | numeric nullable | hours |
| position | integer | ordering within a status column |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| completed_at | timestamptz nullable | set when status → 'done' |
| deleted_at | timestamptz nullable | |

Index: `(workspace_id, status, position)` for kanban board queries.

### `notes`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| workspace_id | uuid FK → workspaces.id | |
| project_id | uuid FK → projects.id, nullable | null = standalone note |
| title | text | |
| body_markdown | text | |
| status | enum('draft','active','archived') | default 'active' |
| pinned | boolean | default false |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| deleted_at | timestamptz nullable | |

Index: full-text search (`tsvector` generated column on `title || body_markdown`) for the global search bar.

### `daily_notes`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| workspace_id | uuid FK → workspaces.id | |
| date | date | unique per (workspace_id, date) |
| morning_goals | text nullable | markdown |
| journal | text nullable | markdown |
| learned | text nullable | markdown |
| wins | text nullable | markdown |
| problems | text nullable | markdown |
| tomorrow | text nullable | markdown |
| created_at | timestamptz | |
| updated_at | timestamptz | |

"Today's Tasks" section on a daily note is NOT a stored column — it's a computed view: tasks with `due_date = daily_notes.date` or created that day. Keeps daily notes from duplicating task state.

Unique constraint: `(workspace_id, date)` — auto-create-on-first-visit logic upserts against this.

### `tags`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| workspace_id | uuid FK → workspaces.id | |
| name | text | |
| color | text nullable | |

Unique constraint: `(workspace_id, name)`.

### `note_tags` / `task_tags` (join tables)

| Column | Type |
|---|---|
| note_id / task_id | uuid FK |
| tag_id | uuid FK |

Composite PK on both columns.

### `task_notes` (join table — "linked notes" on a task)

| Column | Type |
|---|---|
| task_id | uuid FK |
| note_id | uuid FK |

Composite PK on both columns.

### `quick_captures`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| workspace_id | uuid FK → workspaces.id | |
| raw_text | text | |
| triaged_into | enum('note','task') nullable | null while sitting in inbox |
| triaged_id | uuid nullable | points to notes.id or tasks.id once triaged |
| created_at | timestamptz | |

Quick Capture writes here first; triage step converts it into a real Note or Task and stamps `triaged_into`/`triaged_id`. Keeps the fast-capture path from blocking on "which entity is this."

## Extensibility Notes (for Phases 8–10, not built now)

- `notes.body_markdown` and `tasks.description` stay plain markdown text — no vector column added in V1. Phase 8 (AI Layer) adds an `embeddings` table keyed by `(entity_type, entity_id)` rather than polluting core tables with AI-specific columns.
- `task_notes` many-to-many is the seed of Phase 9's knowledge graph — backlinks are just the inverse query on this table plus a future `note_notes` self-referential join table.
- Every table already has `workspace_id`, so multi-workspace (currently Won't Have) is additive, not a migration.
- `deleted_at` soft-deletes everywhere so nothing is destroyed before Phase 9 can graph historical relationships.

## Row-Level Security

Supabase RLS on every table: row visible/writable only if `workspace_id IN (select workspace_id from workspaces where owner_id = auth.uid())`. Enforced at Phase 7 (Backend), not deferred.
