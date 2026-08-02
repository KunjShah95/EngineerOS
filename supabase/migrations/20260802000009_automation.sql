-- EngineerOS — Phase 10: Automation (rules + background job queue)
-- Run after 20260802000008_note_links.sql.
--
-- Three concepts:
--   1. automation_rules — user-configurable rules (recurring tasks, quick-capture
--      auto-triage, daily rollover). Each row is one rule with a kind + config
--      jsonb; enabled rules are evaluated by the drain route.
--   2. jobs — a durable background queue. The quick_captures trigger enqueues an
--      auto_triage job for each new capture, and the engine enqueues reminder
--      jobs when recurring rules ask; the drain route (called by the client on
--      load + interval, mirroring useAutoIndex) processes due work with retry
--      state. This is the "background job queue" BACKEND_ROADMAP.md reserved
--      for Phase 10.
--   3. reminders — the in-app feed materialized by the drain when a reminder
--      job fires (unique job_id → idempotent). Read + mark-read on the dashboard.

create type public.automation_rule_kind as enum ('recurring_task', 'auto_triage', 'daily_rollover');
create type public.automation_job_kind as enum ('auto_triage', 'reminder');
create type public.automation_job_status as enum ('pending', 'running', 'done', 'failed');

create table public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind public.automation_rule_kind not null,
  name text not null,
  config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index automation_rules_workspace_kind_idx on public.automation_rules (workspace_id, kind);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind public.automation_job_kind not null,
  status public.automation_job_status not null default 'pending',
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  error text,
  payload jsonb not null default '{}'::jsonb,
  run_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index jobs_workspace_status_run_at_idx on public.jobs (workspace_id, status, run_at);

-- ============================================================
-- TRIGGER — enqueue auto-triage when a capture is created
-- ============================================================
-- security definer: the enqueue write is system-internal and must not depend
-- on the caller's RLS. Only enqueues when an enabled auto_triage rule exists
-- for the workspace, so the queue stays clean when the feature is off.
create or replace function public.enqueue_auto_triage()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if exists (
    select 1 from public.automation_rules r
    where r.workspace_id = new.workspace_id
      and r.kind = 'auto_triage'
      and r.enabled
      and r.deleted_at is null
  ) then
    insert into public.jobs (workspace_id, kind, payload)
    values (
      new.workspace_id,
      'auto_triage',
      jsonb_build_object('capture_id', new.id)
    );
  end if;
  return new;
end;
$$;

create trigger quick_captures_enqueue_auto_triage
  after insert on public.quick_captures
  for each row execute procedure public.enqueue_auto_triage();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- automation_rules: full member CRUD (the page manages rules directly).
alter table public.automation_rules enable row level security;

create policy "members can read automation rules"
  on public.automation_rules for select using (public.is_workspace_member(workspace_id));
create policy "members can insert automation rules"
  on public.automation_rules for insert with check (public.is_workspace_member(workspace_id));
create policy "members can update automation rules"
  on public.automation_rules for update using (public.is_workspace_member(workspace_id));
create policy "members can delete automation rules"
  on public.automation_rules for delete using (public.is_workspace_member(workspace_id));

-- jobs: the drain route runs as the signed-in user, so members read + claim +
-- clean up their own workspace's jobs. Enqueue is via the security-definer
-- trigger (auto-triage) AND the engine itself (reminder jobs, inserted as the
-- signed-in user through the drain route) — hence the insert policy.
alter table public.jobs enable row level security;

create policy "members can read jobs"
  on public.jobs for select using (public.is_workspace_member(workspace_id));
create policy "members can insert jobs"
  on public.jobs for insert with check (public.is_workspace_member(workspace_id));
create policy "members can update jobs"
  on public.jobs for update using (public.is_workspace_member(workspace_id));
create policy "members can delete jobs"
  on public.jobs for delete using (public.is_workspace_member(workspace_id));

-- ============================================================
-- REMINDERS — the materialized in-app feed (no push/email in V1)
-- ============================================================
-- Rows are created by the drain route when a due reminder job fires. The
-- unique job_id makes processing idempotent across retries (a partial run that
-- created the row but failed to mark the job done won't double-materialize).
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  job_id uuid not null unique references public.jobs (id) on delete cascade,
  rule_id uuid references public.automation_rules (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete cascade,
  title text not null,
  fire_at timestamptz not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index reminders_workspace_read_at_idx on public.reminders (workspace_id, read_at);

-- Full member CRUD: the drain inserts as the user; the UI reads + marks read + clears.
alter table public.reminders enable row level security;

create policy "members can read reminders"
  on public.reminders for select using (public.is_workspace_member(workspace_id));
create policy "members can insert reminders"
  on public.reminders for insert with check (public.is_workspace_member(workspace_id));
create policy "members can update reminders"
  on public.reminders for update using (public.is_workspace_member(workspace_id));
create policy "members can delete reminders"
  on public.reminders for delete using (public.is_workspace_member(workspace_id));
