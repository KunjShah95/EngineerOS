-- EngineerOS — initial schema
-- Source of truth: docs/planning/DATABASE_PLAN.md
-- Run this in the Supabase SQL editor (or via `supabase db push` once linked).

-- ============================================================
-- ENUMS
-- ============================================================
create type public.project_status as enum ('active', 'paused', 'archived');
create type public.task_status as enum ('backlog', 'todo', 'in_progress', 'done');
create type public.task_priority as enum ('none', 'low', 'medium', 'high', 'urgent');
create type public.note_status as enum ('draft', 'active', 'archived');
create type public.capture_type as enum ('note', 'task');

-- ============================================================
-- USERS (app-level profile, mirrors auth.users)
-- ============================================================
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  display_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- WORKSPACES
-- ============================================================
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users (id) on delete cascade,
  name text not null default 'My Workspace',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ============================================================
-- PROJECTS
-- ============================================================
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  description text,
  status public.project_status not null default 'active',
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ============================================================
-- TASKS
-- ============================================================
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  title text not null,
  description text,
  status public.task_status not null default 'backlog',
  priority public.task_priority not null default 'none',
  due_date date,
  estimate numeric,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  deleted_at timestamptz
);

create index tasks_workspace_status_position_idx
  on public.tasks (workspace_id, status, position);

-- ============================================================
-- NOTES (with generated full-text search vector)
-- ============================================================
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  title text not null default 'Untitled',
  body_markdown text not null default '',
  status public.note_status not null default 'active',
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.notes
  add column search_vector tsvector
  generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body_markdown, ''))
  ) stored;

create index notes_search_vector_idx on public.notes using gin (search_vector);
create index notes_workspace_pinned_idx on public.notes (workspace_id, pinned);

-- ============================================================
-- DAILY NOTES
-- ============================================================
create table public.daily_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  date date not null,
  morning_goals text,
  journal text,
  learned text,
  wins text,
  problems text,
  tomorrow text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, date)
);

-- ============================================================
-- TAGS
-- ============================================================
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  color text,
  unique (workspace_id, name)
);

-- ============================================================
-- JOIN TABLES
-- ============================================================
create table public.note_tags (
  note_id uuid not null references public.notes (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (note_id, tag_id)
);

create table public.task_tags (
  task_id uuid not null references public.tasks (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (task_id, tag_id)
);

create table public.task_notes (
  task_id uuid not null references public.tasks (id) on delete cascade,
  note_id uuid not null references public.notes (id) on delete cascade,
  primary key (task_id, note_id)
);

-- ============================================================
-- QUICK CAPTURES
-- ============================================================
create table public.quick_captures (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  raw_text text not null,
  triaged_into public.capture_type,
  triaged_id uuid,
  created_at timestamptz not null default now()
);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-create the profile row + default workspace on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1));

  insert into public.workspaces (owner_id, name)
  values (new.id, 'My Workspace');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Keep updated_at fresh on mutation.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger workspaces_touch
  before update on public.workspaces
  for each row execute procedure public.touch_updated_at();

create trigger projects_touch
  before update on public.projects
  for each row execute procedure public.touch_updated_at();

create trigger tasks_touch
  before update on public.tasks
  for each row execute procedure public.touch_updated_at();

create trigger notes_touch
  before update on public.notes
  for each row execute procedure public.touch_updated_at();

create trigger daily_notes_touch
  before update on public.daily_notes
  for each row execute procedure public.touch_updated_at();

-- Set completed_at when a task moves to 'done'.
create or replace function public.touch_task_completed_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'done' and old.status is distinct from 'done' then
    new.completed_at = now();
  elsif new.status is distinct from 'done' then
    new.completed_at = null;
  end if;
  return new;
end;
$$;

create trigger tasks_completed
  before update on public.tasks
  for each row execute procedure public.touch_task_completed_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspaces w
    where w.id = ws and w.owner_id = auth.uid()
  );
$$;

-- users
alter table public.users enable row level security;

create policy "users can read own profile"
  on public.users for select using (id = auth.uid());
create policy "users can insert own profile"
  on public.users for insert with check (id = auth.uid());
create policy "users can update own profile"
  on public.users for update using (id = auth.uid());
create policy "users can delete own profile"
  on public.users for delete using (id = auth.uid());

-- workspaces
alter table public.workspaces enable row level security;

create policy "owner can read own workspaces"
  on public.workspaces for select using (owner_id = auth.uid());
create policy "owner can insert workspaces"
  on public.workspaces for insert with check (owner_id = auth.uid());
create policy "owner can update own workspaces"
  on public.workspaces for update using (owner_id = auth.uid());
create policy "owner can delete own workspaces"
  on public.workspaces for delete using (owner_id = auth.uid());

-- projects
alter table public.projects enable row level security;

create policy "members can read projects"
  on public.projects for select using (public.is_workspace_member(workspace_id));
create policy "members can insert projects"
  on public.projects for insert with check (public.is_workspace_member(workspace_id));
create policy "members can update projects"
  on public.projects for update using (public.is_workspace_member(workspace_id));
create policy "members can delete projects"
  on public.projects for delete using (public.is_workspace_member(workspace_id));

-- tasks
alter table public.tasks enable row level security;

create policy "members can read tasks"
  on public.tasks for select using (public.is_workspace_member(workspace_id));
create policy "members can insert tasks"
  on public.tasks for insert with check (public.is_workspace_member(workspace_id));
create policy "members can update tasks"
  on public.tasks for update using (public.is_workspace_member(workspace_id));
create policy "members can delete tasks"
  on public.tasks for delete using (public.is_workspace_member(workspace_id));

-- notes
alter table public.notes enable row level security;

create policy "members can read notes"
  on public.notes for select using (public.is_workspace_member(workspace_id));
create policy "members can insert notes"
  on public.notes for insert with check (public.is_workspace_member(workspace_id));
create policy "members can update notes"
  on public.notes for update using (public.is_workspace_member(workspace_id));
create policy "members can delete notes"
  on public.notes for delete using (public.is_workspace_member(workspace_id));

-- daily_notes
alter table public.daily_notes enable row level security;

create policy "members can read daily notes"
  on public.daily_notes for select using (public.is_workspace_member(workspace_id));
create policy "members can insert daily notes"
  on public.daily_notes for insert with check (public.is_workspace_member(workspace_id));
create policy "members can update daily notes"
  on public.daily_notes for update using (public.is_workspace_member(workspace_id));
create policy "members can delete daily notes"
  on public.daily_notes for delete using (public.is_workspace_member(workspace_id));

-- tags
alter table public.tags enable row level security;

create policy "members can read tags"
  on public.tags for select using (public.is_workspace_member(workspace_id));
create policy "members can insert tags"
  on public.tags for insert with check (public.is_workspace_member(workspace_id));
create policy "members can update tags"
  on public.tags for update using (public.is_workspace_member(workspace_id));
create policy "members can delete tags"
  on public.tags for delete using (public.is_workspace_member(workspace_id));

-- quick_captures
alter table public.quick_captures enable row level security;

create policy "members can read captures"
  on public.quick_captures for select using (public.is_workspace_member(workspace_id));
create policy "members can insert captures"
  on public.quick_captures for insert with check (public.is_workspace_member(workspace_id));
create policy "members can update captures"
  on public.quick_captures for update using (public.is_workspace_member(workspace_id));
create policy "members can delete captures"
  on public.quick_captures for delete using (public.is_workspace_member(workspace_id));

-- note_tags (scoped through the parent note)
alter table public.note_tags enable row level security;

create policy "members can read note_tags"
  on public.note_tags for select using (
    exists (
      select 1 from public.notes n
      where n.id = note_id and public.is_workspace_member(n.workspace_id)
    )
  );
create policy "members can insert note_tags"
  on public.note_tags for insert with check (
    exists (
      select 1 from public.notes n
      where n.id = note_id and public.is_workspace_member(n.workspace_id)
    )
  );
create policy "members can delete note_tags"
  on public.note_tags for delete using (
    exists (
      select 1 from public.notes n
      where n.id = note_id and public.is_workspace_member(n.workspace_id)
    )
  );

-- task_tags (scoped through the parent task)
alter table public.task_tags enable row level security;

create policy "members can read task_tags"
  on public.task_tags for select using (
    exists (
      select 1 from public.tasks t
      where t.id = task_id and public.is_workspace_member(t.workspace_id)
    )
  );
create policy "members can insert task_tags"
  on public.task_tags for insert with check (
    exists (
      select 1 from public.tasks t
      where t.id = task_id and public.is_workspace_member(t.workspace_id)
    )
  );
create policy "members can delete task_tags"
  on public.task_tags for delete using (
    exists (
      select 1 from public.tasks t
      where t.id = task_id and public.is_workspace_member(t.workspace_id)
    )
  );

-- task_notes (scoped through the parent task)
alter table public.task_notes enable row level security;

create policy "members can read task_notes"
  on public.task_notes for select using (
    exists (
      select 1 from public.tasks t
      where t.id = task_id and public.is_workspace_member(t.workspace_id)
    )
  );
create policy "members can insert task_notes"
  on public.task_notes for insert with check (
    exists (
      select 1 from public.tasks t
      where t.id = task_id and public.is_workspace_member(t.workspace_id)
    )
  );
create policy "members can delete task_notes"
  on public.task_notes for delete using (
    exists (
      select 1 from public.tasks t
      where t.id = task_id and public.is_workspace_member(t.workspace_id)
    )
  );

-- ============================================================
-- STORAGE (avatars bucket for profile pictures)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "authenticated users can upload avatars"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "anyone can read avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "users can update own avatars"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "users can delete own avatars"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- ============================================================
-- REALTIME (kanban board sync)
-- ============================================================
alter publication supabase_realtime add table public.tasks;
