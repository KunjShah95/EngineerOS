# Resources (Content Types) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five content types — Code Snippets, Bookmarks, Reading, Architecture Notes, Meeting Notes — backed by a single `resources` table with a `kind` discriminator, each reachable via its own sidebar entry and `/kind` list + `/kind/[id]` detail route.

**Architecture:** A `resources` table mirrors `notes` (soft-delete, project FK, tags, tsvector search) plus a `kind` enum and a `metadata` jsonb for kind-specific fields. Hooks in `useResources.ts` mirror `useNotes.ts`. Two shared, kind-aware components — `ResourceList` and `ResourceDetail` — are reused across five thin routes.

**Tech Stack:** Supabase migrations, Next.js App Router + React 19, TypeScript, `@tanstack/react-query`, existing shadcn/radix-nova tokens, `lucide-react`, `src/lib/{utils,task-meta}.ts` not needed here, `src/components/ui/*`. No new deps. No unit-test runner; per-task `npx tsc --noEmit`, then `npm run build` + `npm run lint`.

---

### Task 1: Migration — `resource_kind` enum + `resources` table + `resource_tags` join + RLS + triggers

**Files:**
- Create: `supabase/migrations/20260802000002_resources.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260802000002_resources.sql`:
```sql
-- EngineerOS — resources (content types: code, bookmark, reading, architecture, meeting)
-- Source of truth: docs/superpowers/specs/2026-08-02-resources-design.md

create type public.resource_kind as enum ('code', 'bookmark', 'reading', 'architecture', 'meeting');

-- ============================================================
-- RESOURCES
-- ============================================================
create table public.resources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  kind public.resource_kind not null,
  title text not null default 'Untitled',
  body_markdown text not null default '',
  status public.note_status not null default 'active',
  pinned boolean not null default false,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.resources
  add column search_vector tsvector
  generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' ||
      coalesce(body_markdown, '') || ' ' ||
      coalesce(metadata::text, ''))
  ) stored;

create index resources_search_vector_idx on public.resources using gin (search_vector);
create index resources_workspace_kind_idx on public.resources (workspace_id, kind);

-- ============================================================
-- RESOURCE_TAGS (join table)
-- ============================================================
create table public.resource_tags (
  resource_id uuid not null references public.resources (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (resource_id, tag_id)
);

-- ============================================================
-- TRIGGERS
-- ============================================================
create trigger resources_touch
  before update on public.resources
  for each row execute procedure public.touch_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.resources enable row level security;

create policy "members can read resources"
  on public.resources for select using (public.is_workspace_member(workspace_id));
create policy "members can insert resources"
  on public.resources for insert with check (public.is_workspace_member(workspace_id));
create policy "members can update resources"
  on public.resources for update using (public.is_workspace_member(workspace_id));
create policy "members can delete resources"
  on public.resources for delete using (public.is_workspace_member(workspace_id));

alter table public.resource_tags enable row level security;

create policy "members can read resource_tags"
  on public.resource_tags for select using (
    exists (
      select 1 from public.resources r
      where r.id = resource_id and public.is_workspace_member(r.workspace_id)
    )
  );
create policy "members can insert resource_tags"
  on public.resource_tags for insert with check (
    exists (
      select 1 from public.resources r
      where r.id = resource_id and public.is_workspace_member(r.workspace_id)
    )
  );
create policy "members can delete resource_tags"
  on public.resource_tags for delete using (
    exists (
      select 1 from public.resources r
      where r.id = resource_id and public.is_workspace_member(r.workspace_id)
    )
  );

-- ============================================================
-- REALTIME not enabled for resources (kanban-only, per BACKEND_ROADMAP)
-- ============================================================
```

- [ ] **Step 2: Sanity check**

The migration has no client-side validation available. Optionally run `supabase db lint` if the project is linked (it is not, per our setup) — otherwise skip; the migration is reviewed by eye against the spec.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260802000002_resources.sql
git commit -m "feat(resources): add resources table, kind enum, tags, RLS"
```

---

### Task 2: Types — `database.ts`

**Files:**
- Modify: `src/types/database.ts` (append)

- [ ] **Step 1: Append the resource types**

Add to the end of `src/types/database.ts`:
```ts
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
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: succeeds (types unused yet → no lint error).

- [ ] **Step 3: Commit**

```bash
git add src/types/database.ts
git commit -m "feat(resources): add resource types"
```

---

### Task 3: Hooks — `useResources.ts`

**Files:**
- Create: `src/hooks/useResources.ts`

- [ ] **Step 1: Write the hooks**

Create `src/hooks/useResources.ts`:
```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import type { Resource, ResourceKind, ResourceWithRelations } from "@/types/database";

export interface ResourceFilters {
  projectId?: string | null;
}

export function resourcesQueryKey(
  workspaceId: string | null,
  kind: ResourceKind | null,
  filters?: ResourceFilters | null
) {
  return ["resources", workspaceId ?? "", kind ?? "", filters ?? null] as const;
}

const resourceSelect =
  "*, project:projects(id, name, color), resource_tags(tag:tags(*))";

export async function fetchResources(
  workspaceId: string,
  kind: ResourceKind,
  filters?: ResourceFilters | null
): Promise<ResourceWithRelations[]> {
  const supabase = createClient();
  let query = supabase
    .from("resources")
    .select(resourceSelect)
    .eq("workspace_id", workspaceId)
    .eq("kind", kind)
    .is("deleted_at", null);

  if (filters?.projectId) {
    query = query.eq("project_id", filters.projectId);
  }

  const { data, error } = await query
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ResourceWithRelations[];
}

export async function fetchResource(resourceId: string): Promise<ResourceWithRelations | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("resources")
    .select(resourceSelect)
    .eq("id", resourceId)
    .maybeSingle();

  if (error) throw error;
  return data as ResourceWithRelations | null;
}

export function useResources(
  workspaceId: string | null,
  kind: ResourceKind | null,
  filters?: ResourceFilters | null
) {
  return useQuery({
    queryKey: resourcesQueryKey(workspaceId, kind, filters),
    queryFn: () => fetchResources(workspaceId!, kind!, filters),
    enabled: Boolean(workspaceId) && Boolean(kind),
  });
}

export function useResource(resourceId: string) {
  return useQuery({
    queryKey: ["resource", resourceId],
    queryFn: () => fetchResource(resourceId),
    enabled: Boolean(resourceId),
  });
}

export interface CreateResourceInput {
  title?: string;
  body_markdown?: string;
  project_id?: string | null;
  metadata?: ResourceWithRelations["metadata"];
  status?: ResourceWithRelations["status"];
}

export function useCreateResource(
  workspaceId: string | null,
  kind: ResourceKind | null,
  filters?: ResourceFilters | null
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateResourceInput) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("resources")
        .insert({
          workspace_id: workspaceId,
          kind,
          title: input.title ?? "Untitled",
          body_markdown: input.body_markdown ?? "",
          project_id: input.project_id ?? null,
          metadata: input.metadata ?? {},
        })
        .select()
        .single();

      if (error) throw error;
      return data as Resource;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: resourcesQueryKey(workspaceId, kind, filters) });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export type ResourcePatch = Partial<
  Pick<Resource, "title" | "body_markdown" | "project_id" | "pinned" | "status"> & {
    metadata: ResourceWithRelations["metadata"];
  }
>;

export function useUpdateResource(resourceId: string, workspaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patch: ResourcePatch) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("resources")
        .update(patch)
        .eq("id", resourceId)
        .select()
        .single();

      if (error) throw error;
      return data as Resource;
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: ["resource", resourceId] });
      const previous = queryClient.getQueryData<ResourceWithRelations | null>(["resource", resourceId]);

      if (previous) {
        queryClient.setQueryData<ResourceWithRelations | null>(["resource", resourceId], {
          ...previous,
          ...patch,
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["resource", resourceId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["resource", resourceId] });
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

/** Soft-delete a resource. */
export function useDeleteResource(resourceId: string, workspaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from("resources")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", resourceId);

      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      queryClient.invalidateQueries({ queryKey: ["resource", resourceId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Resource ⇄ tags (many-to-many via resource_tags)
// ---------------------------------------------------------------------------

export function useSetResourceTags(resourceId: string, workspaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tagIds: string[]) => {
      const supabase = createClient();

      const { error: delError } = await supabase
        .from("resource_tags")
        .delete()
        .eq("resource_id", resourceId);
      if (delError) throw delError;

      if (tagIds.length > 0) {
        const { error: insError } = await supabase
          .from("resource_tags")
          .insert(tagIds.map((tag_id) => ({ resource_id: resourceId, tag_id })));
        if (insError) throw insError;
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["resource", resourceId] });
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors (unused until Task 6+).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useResources.ts
git commit -m "feat(resources): add resource hooks (list, detail, CRUD, tags)"
```

---

### Task 4: Metadata helper + kind-config map

Tiny shared module so `ResourceList` and `ResourceDetail` agree on kind chips / field editors without switch clutter.

**Files:**
- Create: `src/lib/resource-kind.ts`

- [ ] **Step 1: Write the module**

Create `src/lib/resource-kind.ts`:
```ts
import {
  BookOpenText,
  Bookmark,
  Code2,
  Network,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { ResourceKind, ReadingStatus } from "@/types/database";

export type { ResourceKind };

export interface KindMeta {
  kind: ResourceKind;
  label: string;
  plural: string;
  icon: LucideIcon;
  hasUrl: boolean;
  hasLanguage: boolean;
  hasReadStatus: boolean;
  hasMeetingDate: boolean;
  hasAttendees: boolean;
}

const KIND_META: Record<ResourceKind, KindMeta> = {
  code: { kind: "code", label: "Code Snippet", plural: "Code Snippets", icon: Code2, hasUrl: false, hasLanguage: true, hasReadStatus: false, hasMeetingDate: false, hasAttendees: false },
  bookmark: { kind: "bookmark", label: "Bookmark", plural: "Bookmarks", icon: Bookmark, hasUrl: true, hasLanguage: false, hasReadStatus: false, hasMeetingDate: false, hasAttendees: false },
  reading: { kind: "reading", label: "Reading Item", plural: "Reading", icon: BookOpenText, hasUrl: true, hasLanguage: false, hasReadStatus: true, hasMeetingDate: false, hasAttendees: false },
  architecture: { kind: "architecture", label: "Architecture Note", plural: "Architecture", icon: Network, hasUrl: false, hasLanguage: false, hasReadStatus: false, hasMeetingDate: false, hasAttendees: false },
  meeting: { kind: "meeting", label: "Meeting Note", plural: "Meetings", icon: Users, hasUrl: false, hasLanguage: false, hasReadStatus: false, hasMeetingDate: true, hasAttendees: true },
};

export function getResourceKindMeta(kind: ResourceKind): KindMeta {
  return KIND_META[kind];
}

export const READING_STATUS_LABELS: Record<ReadingStatus, string> = {
  want: "Want to Read",
  reading: "Reading",
  done: "Done",
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/resource-kind.ts
git commit -m "feat(resources): add kind metadata/config maps"
```

---

### Task 5: Shared `ResourceList` component

**Files:**
- Create: `src/components/resource/ResourceList.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/resource/ResourceList.tsx`:
```tsx
"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Pin, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shell/EmptyState";
import { useCreateResource, useResources } from "@/hooks/useResources";
import { useProjects } from "@/hooks/useProjects";
import { useWorkspace } from "@/hooks/useWorkspace";
import { getResourceKindMeta, READING_STATUS_LABELS } from "@/lib/resource-kind";
import { projectColorStyle } from "@/lib/project-colors";
import { cn } from "@/lib/utils";
import type { ResourceKind, ResourceWithRelations } from "@/types/database";

function snippet(body: string): string {
  return body
    .replace(/[#*`>_~\[\]()!-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

export function ResourceList({
  kind,
  icon,
  title,
  emptyDescription,
}: {
  kind: ResourceKind;
  icon: typeof Pin;
  title: string;
  emptyDescription: string;
}) {
  const meta = getResourceKindMeta(kind);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: workspace } = useWorkspace();
  const workspaceId = workspace?.id ?? null;

  const { data: projects } = useProjects(workspaceId);
  const projectFilter = searchParams.get("project") ?? "all";

  const { data: resources, isLoading } = useResources(
    workspaceId,
    kind,
    projectFilter === "all" ? null : { projectId: projectFilter }
  );

  const createResource = useCreateResource(workspaceId, kind);

  const filtered = useMemo(() => resources ?? [], [resources]);

  const setProject = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") params.delete("project");
    else params.set("project", value);
    router.replace(`/${kind}?${params.toString()}`);
  };

  const newResource = async () => {
    const resource = await createResource.mutateAsync({});
    router.push(`/${kind}/${resource.id}`);
  };

  const EmptyIcon = icon;

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="text-sm text-secondary">
            {filtered.length} {filtered.length === 1 ? "item" : "items"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={projectFilter} onValueChange={setProject}>
            <SelectTrigger size="sm" aria-label="Filter by project" className="min-w-36">
              <SelectValue placeholder="All projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {(projects ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button size="sm" onClick={() => void newResource()} disabled={createResource.isPending}>
            <Plus className="size-4" strokeWidth={1.75} />
            New
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={EmptyIcon}
          title={projectFilter !== "all" ? "No matching items" : `No ${meta.plural.toLowerCase()} yet`}
          description={
            projectFilter !== "all"
              ? "Try clearing the filter, or create a new item."
              : emptyDescription
          }
          actionLabel={projectFilter !== "all" ? undefined : "New"}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((resource) => (
            <ResourceRow key={resource.id} kind={kind} resource={resource} />
          ))}
        </div>
      )}
    </div>
  );
}

function ResourceRow({ kind, resource }: { kind: ResourceKind; resource: ResourceWithRelations }) {
  const tagsList = resource.resource_tags.map((rt) => rt.tag);
  const m = resource.metadata;

  return (
    <Link
      href={`/${kind}/${resource.id}`}
      className={cn(
        "group flex items-start justify-between gap-4 rounded-lg border border-default bg-surface p-4 transition-colors duration-150",
        "hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {resource.pinned ? (
            <Pin className="size-3.5 shrink-0 text-accent" strokeWidth={1.75} />
          ) : null}
          <h3 className="truncate text-sm font-medium text-foreground">{resource.title}</h3>
        </div>

        {snippet(resource.body_markdown) ? (
          <p className="mt-1 line-clamp-2 text-sm text-secondary">{snippet(resource.body_markdown)}</p>
        ) : m.language || m.url ? null : (
          <p className="mt-1 text-sm text-faint">No content yet.</p>
        )}

        <ResourceChips resource={resource} />

        {(resource.project || tagsList.length > 0) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {resource.project ? (
              <span className="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px] font-medium text-secondary">
                <span
                  className="size-2 rounded-full"
                  style={projectColorStyle(resource.project.color)}
                  aria-hidden
                />
                {resource.project.name}
              </span>
            ) : null}
            {tagsList.map((tag) => (
              <span
                key={tag.id}
                className="rounded px-1.5 py-0.5 text-[11px] font-medium text-accent"
                style={tag.color ? { backgroundColor: tag.color, color: "#fff" } : undefined}
              >
                #{tag.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <span className="shrink-0 text-xs text-faint">
        {formatDistanceToNow(new Date(resource.updated_at), { addSuffix: true })}
      </span>
    </Link>
  );
}

function ResourceChips({ resource }: { resource: ResourceWithRelations }) {
  const m = resource.metadata;
  const chips: React.ReactNode[] = [];

  if (m.url) {
    chips.push(
      <a
        key="url"
        href={m.url}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="rounded px-1.5 py-0.5 text-[11px] font-medium text-accent underline-offset-2 hover:underline"
      >
        ↗ {m.url}
      </a>
    );
  }
  if (m.language) {
    chips.push(
      <span key="lang" className="rounded px-1.5 py-0.5 text-[11px] font-medium text-secondary">
        {m.language}
      </span>
    );
  }
  if (m.read_status) {
    chips.push(
      <span key="status" className="rounded px-1.5 py-0.5 text-[11px] font-medium text-accent">
        {READING_STATUS_LABELS[m.read_status]}
      </span>
    );
  }
  if (m.meeting_date) {
    chips.push(
      <span key="date" className="rounded px-1.5 py-0.5 text-[11px] font-medium text-secondary">
        {new Date(m.meeting_date).toLocaleDateString()}
      </span>
    );
  }

  if (chips.length === 0) return null;
  return <div className="mt-1.5 flex flex-wrap items-center gap-2">{chips}</div>;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS. Note: `icon: typeof Pin` is a deliberate loose `LucideIcon`-compatible type; `getResourceKindMeta(kind).icon` is not used in list (we accept an `icon` prop). If lint flags `Pin` import only used for the type, keep the import.

- [ ] **Step 3: Commit**

```bash
git add src/components/resource/ResourceList.tsx
git commit -m "feat(resources): add shared kind-aware resource list"
```

---

### Task 6: Shared `ResourceDetail` editor (incl. kind metadata fields)

**Files:**
- Create: `src/components/resource/KindFields.tsx`
- Create: `src/components/resource/ResourceDetail.tsx`

- [ ] **Step 1: Write `KindFields`**

Create `src/components/resource/KindFields.tsx`:
```tsx
"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getResourceKindMeta, READING_STATUS_LABELS } from "@/lib/resource-kind";
import type { ResourceKind, ResourceMetadata } from "@/types/database";

export function KindFields({
  kind,
  metadata,
  onChange,
}: {
  kind: ResourceKind;
  metadata: ResourceMetadata;
  onChange: (patch: Partial<ResourceMetadata>) => void;
}) {
  const meta = getResourceKindMeta(kind);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {meta.hasUrl ? (
        <div className="space-y-1">
          <label className="text-xs font-medium text-faint">URL</label>
          <Input
            type="url"
            value={metadata.url ?? ""}
            onChange={(e) => onChange({ url: e.target.value })}
            placeholder="https://…"
          />
        </div>
      ) : null}

      {meta.hasLanguage ? (
        <div className="space-y-1">
          <label className="text-xs font-medium text-faint">Language</label>
          <Input
            value={metadata.language ?? ""}
            onChange={(e) => onChange({ language: e.target.value })}
            placeholder="TypeScript, SQL, …"
          />
        </div>
      ) : null}

      {meta.hasReadStatus ? (
        <div className="space-y-1">
          <label className="text-xs font-medium text-faint">Status</label>
          <Select
            value={metadata.read_status ?? "want"}
            onValueChange={(v) => onChange({ read_status: v as ResourceMetadata["read_status"] })}
          >
            <SelectTrigger className="w-full" aria-label="Reading status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="want">{READING_STATUS_LABELS.want}</SelectItem>
              <SelectItem value="reading">{READING_STATUS_LABELS.reading}</SelectItem>
              <SelectItem value="done">{READING_STATUS_LABELS.done}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {meta.hasMeetingDate ? (
        <div className="space-y-1">
          <label className="text-xs font-medium text-faint">Date</label>
          <Input
            type="date"
            value={metadata.meeting_date ?? ""}
            onChange={(e) => onChange({ meeting_date: e.target.value || null })}
          />
        </div>
      ) : null}

      {meta.hasAttendees ? (
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium text-faint">Attendees</label>
          <Input
            value={metadata.attendees?.join(", ") ?? ""}
            onChange={(e) =>
              onChange({
                attendees: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
              })
            }
            placeholder="Comma-separated names"
          />
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Write `ResourceDetail`**

Create `src/components/resource/ResourceDetail.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Eye,
  Loader2,
  Pencil,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageLoader } from "@/components/shell/PageLoader";
import { EmptyState } from "@/components/shell/EmptyState";
import { MarkdownRenderer } from "@/components/note/MarkdownRenderer";
import { TagInput } from "@/components/note/TagInput";
import { KindFields } from "@/components/resource/KindFields";
import { getResourceKindMeta } from "@/lib/resource-kind";
import {
  useDeleteResource,
  useResource,
  useSetResourceTags,
  useUpdateResource,
} from "@/hooks/useResources";
import { useProjects } from "@/hooks/useProjects";
import { useTags } from "@/hooks/useTags";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";
import { useSyncedState } from "@/lib/use-synced-state";
import { cn } from "@/lib/utils";
import type { ResourceKind } from "@/types/database";

type EditorMode = "edit" | "preview";

export function ResourceDetail({
  resourceId,
  kind,
}: {
  resourceId: string;
  kind: ResourceKind;
}) {
  const meta = getResourceKindMeta(kind);
  const router = useRouter();
  const { data: workspace } = useWorkspace();
  const workspaceId = workspace?.id ?? null;

  const { data: resource, isLoading } = useResource(resourceId);
  const { data: projects } = useProjects(workspaceId);
  const { data: tags } = useTags(workspaceId);
  const updateResource = useUpdateResource(resourceId, workspaceId);
  const setResourceTags = useSetResourceTags(resourceId, workspaceId);
  const deleteResource = useDeleteResource(resourceId, workspaceId);

  const [mode, setMode] = useSyncedState<EditorMode>(
    resource?.body_markdown ? "preview" : "edit"
  );
  const [title, setTitle] = useSyncedState(resource?.title ?? "");
  const [body, setBody] = useSyncedState(resource?.body_markdown ?? "");
  const [metadata, setMetadata] = useSyncedState(resource?.metadata ?? {});
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (justSaved) {
      const t = setTimeout(() => setJustSaved(false), 1500);
      return () => clearTimeout(t);
    }
  }, [justSaved]);

  const saveTitle = useDebouncedCallback((value: string) => {
    updateResource.mutate({ title: value }, { onSuccess: () => setJustSaved(true) });
  }, 600);

  const saveBody = useDebouncedCallback((value: string) => {
    updateResource.mutate(
      { body_markdown: value },
      { onSuccess: () => setJustSaved(true), onError: () => toast.error("Failed to save") }
    );
  }, 600);

  const saveMetadata = useDebouncedCallback((value: typeof metadata) => {
    updateResource.mutate(
      { metadata: value },
      { onSuccess: () => setJustSaved(true), onError: () => toast.error("Failed to save") }
    );
  }, 600);

  if (isLoading || !workspace) return <PageLoader label="Loading…" />;

  if (!resource) {
    return (
      <EmptyState
        icon={meta.icon}
        title="Not found"
        description="It may have been deleted or the link is wrong."
      />
    );
  }

  const tagIds = (resource.resource_tags ?? []).map((rt) => rt.tag.id);
  const isSaving = updateResource.isPending;

  const handleDelete = async () => {
    await deleteResource.mutateAsync();
    toast.success("Deleted");
    router.push(`/${kind}`);
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-6">
      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/${kind}`}
          className="inline-flex items-center gap-1.5 text-sm text-secondary transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" strokeWidth={1.75} />
          {meta.plural}
        </Link>

        <div className="flex items-center gap-1">
          <span className="mr-1 inline-flex items-center gap-1.5 text-xs text-faint">
            {isSaving || justSaved ? (
              <>
                {isSaving ? (
                  <Loader2 className="size-3 animate-spin" strokeWidth={1.75} />
                ) : (
                  <Check className="size-3 text-success" strokeWidth={1.75} />
                )}
                {isSaving ? "Saving…" : "Saved"}
              </>
            ) : null}
          </span>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMode(mode === "edit" ? "preview" : "edit")}
            aria-label={mode === "edit" ? "Preview rendered markdown" : "Edit markdown"}
          >
            {mode === "edit" ? (
              <Eye className="size-4" strokeWidth={1.75} />
            ) : (
              <Pencil className="size-4" strokeWidth={1.75} />
            )}
            {mode === "edit" ? "Preview" : "Edit"}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              updateResource.mutate({ pinned: !resource.pinned }, { onSuccess: () => setJustSaved(true) })
            }
            aria-label={resource.pinned ? "Unpin" : "Pin"}
            title={resource.pinned ? "Unpin" : "Pin"}
            className={cn(resource.pinned && "text-accent")}
          >
            {resource.pinned ? (
              <Pin className="size-4" strokeWidth={1.75} />
            ) : (
              <PinOff className="size-4" strokeWidth={1.75} />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => void handleDelete()}
            aria-label="Delete"
            className="text-danger hover:bg-danger/10 hover:text-danger"
          >
            <Trash2 className="size-4" strokeWidth={1.75} />
          </Button>
        </div>
      </div>

      <Input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          saveTitle(e.target.value);
        }}
        onBlur={() =>
          updateResource.mutate({ title }, { onSuccess: () => setJustSaved(true) })
        }
        placeholder="Untitled"
        aria-label="Title"
        className="mb-4 h-auto border-none bg-transparent px-0 text-2xl font-semibold shadow-none focus-visible:ring-0 focus-visible:border-transparent placeholder:text-faint"
      />

      <div className="mb-4 rounded-lg border border-border-subtle bg-surface p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-faint uppercase tracking-wide">
          <meta.icon className="size-4" strokeWidth={1.75} />
          {meta.label} fields
        </div>
        <KindFields
          kind={kind}
          metadata={metadata}
          onChange={(patch) => {
            const next = { ...metadata, ...patch };
            setMetadata(next);
            saveMetadata(next);
          }}
        />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border-subtle pb-4 text-xs text-faint">
        <Select
          value={resource.project_id ?? "none"}
          onValueChange={(v) =>
            updateResource.mutate({ project_id: v === "none" ? null : v }, { onSuccess: () => setJustSaved(true) })
          }
        >
          <SelectTrigger size="sm" className="h-7 text-xs" aria-label="Project">
            <SelectValue placeholder="No project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No project</SelectItem>
            {(projects ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <TagInput
          workspaceId={workspace.id}
          tagIds={tagIds}
          allTags={tags ?? []}
          onChange={(nextIds) => setResourceTags.mutate(nextIds)}
        />

        <span className="ml-auto">
          Updated {new Date(resource.updated_at).toLocaleString()}
        </span>
      </div>

      {mode === "edit" ? (
        <textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            saveBody(e.target.value);
          }}
          onBlur={() =>
            updateResource.mutate(
              { body_markdown: body },
              { onSuccess: () => setJustSaved(true), onError: () => toast.error("Failed to save") }
            )
          }
          placeholder="Write in markdown…"
          aria-label="Body (markdown)"
          className="field-sizing-content min-h-[50vh] w-full resize-y rounded-lg border border-border-subtle bg-transparent px-4 py-3 text-sm leading-relaxed text-foreground outline-none transition-colors duration-150 placeholder:text-faint focus:border-default focus:ring-2 focus:ring-ring/30"
        />
      ) : body.trim() ? (
        <div className="rounded-lg border border-border-subtle bg-surface px-6 py-4">
          <MarkdownRenderer content={body} />
        </div>
      ) : (
        <EmptyState
          icon={meta.icon}
          title="Nothing written yet"
          description="Flip to edit mode and write your first markdown body."
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS. Watch `useSyncedState` generics (`metadata` default `resource?.metadata ?? {}` typed as `ResourceMetadata`).

- [ ] **Step 4: Commit**

```bash
git add src/components/resource/KindFields.tsx src/components/resource/ResourceDetail.tsx
git commit -m "feat(resources): add shared resource detail editor and kind fields"
```

---

### Task 7: Routes (5 × list + detail)

**Files:**
- Create: `src/app/(app)/code/page.tsx`, `src/app/(app)/code/[id]/page.tsx`
- Create: `src/app/(app)/bookmarks/page.tsx`, `src/app/(app)/bookmarks/[id]/page.tsx`
- Create: `src/app/(app)/reading/page.tsx`, `src/app/(app)/reading/[id]/page.tsx`
- Create: `src/app/(app)/architecture/page.tsx`, `src/app/(app)/architecture/[id]/page.tsx`
- Create: `src/app/(app)/meetings/page.tsx`, `src/app/(app)/meetings/[id]/page.tsx`

- [ ] **Step 1: Create the ten route files**

For each kind, a list page and a detail page (Suspense + PageLoader). Use the exact pattern below, substituting per kind.

`src/app/(app)/code/page.tsx`:
```tsx
import { Suspense } from "react";
import { Code2 } from "lucide-react";

import { ResourceList } from "@/components/resource/ResourceList";
import { PageLoader } from "@/components/shell/PageLoader";

export default function CodePage() {
  return (
    <Suspense fallback={<PageLoader label="Loading…" />}>
      <ResourceList
        kind="code"
        icon={Code2}
        title="Code Snippets"
        emptyDescription="Save reusable snippets of code. Add a language and a markdown body."
      />
    </Suspense>
  );
}
```

`src/app/(app)/code/[id]/page.tsx`:
```tsx
import { Suspense } from "react";

import { ResourceDetail } from "@/components/resource/ResourceDetail";
import { PageLoader } from "@/components/shell/PageLoader";

export default async function CodeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<PageLoader label="Loading…" />}>
      <ResourceDetail resourceId={id} kind="code" />
    </Suspense>
  );
}
```

Repeat for the other kinds with these substitutions:

| Kind | list icon | list title | empty description | detail kind |
|---|---|---|---|---|
| `bookmark` | `Bookmark` | "Bookmarks" | "Save links you want to revisit. Add a URL and context." | `bookmark` |
| `reading` | `BookOpenText` | "Reading" | "Build a reading list. Track what you want, are reading, or finished." | `reading` |
| `architecture` | `Network` | "Architecture" | "Capture design decisions and system notes." | `architecture` |
| `meeting` | `Users` | "Meetings" | "Record meeting notes with dates and attendees." | `meeting` |

> Note: the list page `icon` prop must be the `lucide-react` component (e.g. `Bookmark`, `BookOpenText`, `Network`, `Users`) imported into that file, matching the module `getResourceKindMeta` uses.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS. Earlier-created modules now consumed.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/code" "src/app/(app)/bookmarks" "src/app/(app)/reading" "src/app/(app)/architecture" "src/app/(app)/meetings"
git commit -m "feat(resources): add code, bookmarks, reading, architecture, meetings routes"
```

---

### Task 8: Nav entries + icons

**Files:**
- Modify: `src/components/shell/AppNav.tsx`

- [ ] **Step 1: Add nav items**

Add the five icons to the lucide import block (existing icons remain):
```tsx
import {
  BookOpenText,
  Bookmark,
  Calendar,
  CalendarDays,
  CheckSquare,
  Code2,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Network,
  Search,
  Settings,
  Users,
} from "lucide-react";
```
And append to `navItems` (after Daily, before Settings — order: Dashboard, Projects, Tasks, Calendar, Notes, Daily, then the new library group):
```tsx
  { href: "/code", label: "Code", icon: Code2 },
  { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { href: "/reading", label: "Reading", icon: BookOpenText },
  { href: "/architecture", label: "Architecture", icon: Network },
  { href: "/meetings", label: "Meetings", icon: Users },
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/shell/AppNav.tsx
git commit -m "feat(resources): add content-type nav entries"
```

---

### Task 9: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: succeeds; route table includes `○ /code`, `○ /bookmarks`, `○ /reading`, `○ /architecture`, `○ /meetings` and their `[id]` detail routes.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: `eslint` exits 0 (no errors or warnings).

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Confirm branch state**

Run: `git status --short` (only deltas from this feature) and `git log --oneline -12` to confirm the feature commits are present on `feat/resources`. The marketing workstream (untracked `src/components/marketing/` + modified `globals.css`/`project-colors.ts`/`(marketing)/page.tsx`) should remain untouched.

---

## Self-Review

**Spec coverage:**
- `resources` table + `resource_kind` enum + metadata + tsvector + RLS + resource_tags + triggers → Task 1. ✓
- Types (`ResourceKind`, `ReadingStatus`, `ResourceMetadata`, `Resource`, `ResourceWithRelations`) → Task 2. ✓
- Full hook set mirroring `useNotes` → Task 3. ✓
- Kind config map + reading labels → Task 4. ✓
- Shared kind-aware list with project filter + chips + new → Task 5. ✓
- Shared detail editor with debounced autosave + `TagInput` + kind fields → Task 6. ✓
- 5 × list + detail routes → Task 7. ✓
- Nav entries + icons → Task 8. ✓
- Build/lint/tsc + branch-state verification → Task 9. ✓

**Placeholder scan:** every file has complete literal code; empty descriptions and props are concrete; no TBD/TODO.

**Type consistency:** `useCreateResource` inserts `resource_id` (workspace_id) and `kind`. `useResources` filters by the passed `kind`. `getResourceKindMeta(kind)` is used in both list (implicitly via kind routing) and detail. `ResourceDetail` reads `resource.kind` from URL — wait, it takes `kind` prop, while list navigates to `/${kind}/${id}` — consistent. `KindFields.hasUrl`/`hasLanguage`/`hasReadStatus`/`hasMeetingDate`/`hasAttendees` match `metadata` keys in `ResourceMetadata`. `getResourceKindMeta` icon reused in `ResourceDetail` (`meta.icon`). `ReadingStatusLabels` matches `READING_STATUS_LABELS` keys. `useDebouncedCallback` and `useSyncedState` match existing imports from `lib/`.