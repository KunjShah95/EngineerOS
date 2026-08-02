# Resources (Content Types) Design Spec

**Date:** 2026-08-02
**Status:** Approved
**Branch:** `feat/resources`

## Goal

Ship the five MVP "Should Have" content types — **Code Snippets, Bookmarks, Reading List, Architecture Notes, Meeting Notes** — on a single shared `resources` data model with a `kind` discriminator. Each type is reachable through its own sidebar entry and route, with a reusable list + detail editor surface.

## Non-Goals / Scope Boundary

- No AI layer, embeddings, or summaries (Phase 8 deferred).
- No attachments or PDF upload.
- No OAuth/GitHub/calendar-sync integrations (Group B, separate later effort).
- Global command-palette search is not extended to resources in this pass (tags already give cross-entity discovery; a follow-up can add resource results).
- No hard deletes: everything soft-deleted via `deleted_at` (matches existing convention, needed later by the knowledge graph).

## Data Model

A single `resources` table mirrors `notes` and adds a `kind` column plus a `metadata` jsonb column for kind-specific fields.

### New enum

```sql
create type public.resource_kind as enum ('code', 'bookmark', 'reading', 'architecture', 'meeting');
```

### `resources`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK default gen_random_uuid() | |
| workspace_id | uuid FK → workspaces.id | |
| project_id | uuid FK → projects.id, nullable | |
| kind | `resource_kind` not null | discriminator |
| title | text not null default 'Untitled' | |
| body_markdown | text not null default '' | |
| status | `note_status` default 'active' | reuse existing note status |
| pinned | boolean not null default false | |
| metadata | jsonb not null default '{}' | kind-specific fields |
| created_at | timestamptz default now() | |
| updated_at | timestamptz default now() | |
| deleted_at | timestamptz nullable | soft delete |

### `resource_tags` (join table)

| Column | Type |
|---|---|
| resource_id | uuid FK → resources.id on delete cascade |
| tag_id | uuid FK → tags.id on delete cascade |

Composite PK on both columns. Mirrors `note_tags`.

### Kind-specific `metadata` keys

| Kind | Keys | Purpose |
|---|---|---|
| `code` | `language` (text) | display "New Code Snippet" row chip |
| `bookmark` | `url` (text) | link out |
| `reading` | `url` (text), `read_status` enum-text: `want`/`reading`/`done` | link + progress |
| `architecture` | (*none*) | free-form markdown |
| `meeting` | `meeting_date` (date, nullable), `attendees` (array of text) | context |

The `metadata` jsonb is unconstrained; the client normalizes known keys. Rows always carry a `kind` so unknown/invalid metadata is simply ignored by the UI.

### Full-text search vector

```sql
alter table public.resources
  add column search_vector tsvector
  generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' ||
      coalesce(body_markdown, '') || ' ' ||
      coalesce(metadata::text, ''))
  ) stored;
create index resources_search_vector_idx on public.resources using gin (search_vector);
create index resources_workspace_kind_idx on public.resources (workspace_id, kind);
```

### Triggers

- `resources_touch` — before update → `updated_at = now()` (reuse `touch_updated_at()` function).

### RLS

`resources` and `resource_tags` get the identical policy set as `notes` / `note_tags`, all via `public.is_workspace_member(workspace_id)` (or a parent-subquery for the join table). Four policies per table (select/insert/update/delete).

## Types

Extend `src/types/database.ts`:

```ts
export type ResourceKind = "note" | "bookmark" | "reading" | "architecture" | "meeting";
export type ReadingStatus = "want" | "reading" | "done";

export interface ResourceMetadata {
  url?: string;
  language?: string;
  read_status?: ReadingStatus;
  meeting_date?: string | null;
  attendees?: string[];
}

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

export interface ResourceWithRelations extends Resource {
  project: { id: string; name: string; color: string | null } | null;
  resource_tags: { tag: Tag }[];
}
```

## Hooks (`src/hooks/useResources.ts`)

Mirror `useNotes.ts` exactly, adding a `kind` param to the list + create queries:

- `resourcesQueryKey(workspaceId, kind, filters)` → `["resources", ws, kind, filters]`
- `fetchResources(workspaceId, kind, filters?)` — select `*, project:projects(id,name,color), resource_tags(tag:tags(*))`, filter `workspace_id`, `kind`, `.is("deleted_at", null)`, filter `project_id` if given, order pinned desc then updated_at desc.
- `fetchResource(id)`
- `useResources(workspaceId, kind, filters?)`
- `useResource(resourceId)`
- `useCreateResource(workspaceId, kind)` — insert `{ workspace_id, kind, ...input }`
- `useUpdateResource(resourceId, workspaceId)` — patches title/body/project/status/pinned/metadata
- `useDeleteResource(resourceId, workspaceId)` — soft delete
- `useSetResourceTags(resourceId, workspaceId)` — delete+reinsert in `resource_tags`

## UI

### Nav

Add 5 sidebar entries (in `AppNav.tsx`):
- `/code` → Code, icon `Code2`
- `/bookmarks` → Bookmarks, icon `Bookmark`
- `/reading` → Reading, icon `BookOpenText`
- `/architecture` → Architecture, icon `Network`
- `/meetings` → Meetings, icon `Users`

### Shared `ResourceList` (`src/components/resource/ResourceList.tsx`)

One parameterized list. Props: `{ kind, icon, title, emptyTitle, emptyDescription }`. Mirrors `NotesList` behaviour:
- Header with count, project filter select, "New <Kind>" button.
- Row per resource: pin icon, title, auto-snippet of body, project chip + tags, updated-at distance.
- **Kind chip row**: renders a small chip from `metadata` — bookmark → url (link), code → language, reading → read-status badge + url, meeting → date. No chip for architecture.
- Click row → navigates to `/code`+kind+`+/`+id.
- New → creates with kind, pushes to detail.

### Shared `ResourceDetail` (`src/components/resource/ResourceDetail.tsx`)

Mirrors `NoteDetail`: page header with back link, save spinner, Preview/Edit toggle, pin, delete; debounced autosave for title/body; project select; `TagInput`. On top, renders a **`<KindFields kind metadata onChange>`** block conditionally:
- code → input for `language`
- bookmark → input for `url` (with "Open" link when set)
- reading → input for `url` + `Select` for `read_status` (Want to Read / Reading / Done)
- meeting → `<input type="date">` for meeting_date + comma-separated textarea for attendees
- architecture → none

`getResourceKindMeta(kind)` helper maps each kind to `{ icon, label, plural, MetadataEditor }` to avoid switch clutter.

### Routes (5 × list + detail)

For each kind, under `(app)`:
- `/code/page.tsx` + `/code/[id]/page.tsx` — `ResourceList` wrapped in `Suspense` (`ResourceDetail` wrapped in `Suspense` + `PageLoader`).

All routes protected by the existing `proxy.ts` middleware (under `(app)`), no change needed.

## Error / Loading / Empty States

- Loading by `isLoading` → `Skeleton` rows in list, `PageLoader` in detail.
- Error → `EmptyState` with icon + "Couldn't load…" message.
- Empty list → `EmptyState` with kind-specific title + "New <Kind>" action.
- Delete → toast + back to list.
- Autosave error → toast.

## Testing / Verification

- No unit-test runner (project convention). Per-task: `npx tsc --noEmit`.
- End-to-end: `npm run build` (route table includes the 5 new list + detail routes) + `npm run lint`.
- Runtime (needs Supabase): open each `/kind`, create a resource, verify metadata fields persist, filter by project, jump to detail, confirm saved indicator.

## Open Questions (resolved)

- **Editor:** Debounced markdown auto-save (reuse `NoteDetail` pattern) — **resolved: yes**.
- **Detail routes:** Each kind keeps its own `/kind/<id>` detail route — **resolved: separate per-kind detail**, matching chosen separate nav.
- **Body for bookmark/reading:** a resource needs body; bookmark can hold a summary or be left blank — **resolved: body always available, optional**.