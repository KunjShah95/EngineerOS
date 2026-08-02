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