-- EngineerOS — stale-decision alerts.
--
-- Decision records rot silently: six months later a PR adds Redis and the
-- "no Redis, Postgres is enough" record still reads as current. When a new
-- decision is saved, AI compares it with related earlier ones; suspected
-- reversals land here for a human to accept (earlier record becomes
-- superseded) or dismiss.

alter table public.decision_records
  add column if not exists status text not null default 'active'
    check (status in ('active', 'superseded')),
  add column if not exists superseded_by uuid references public.decision_records (id) on delete set null;

create index if not exists decision_records_workspace_status_idx
  on public.decision_records (workspace_id, status);

create table if not exists public.decision_conflicts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- The newer decision that triggered the check…
  decision_id uuid not null references public.decision_records (id) on delete cascade,
  -- …and the earlier one it may reverse.
  earlier_decision_id uuid not null references public.decision_records (id) on delete cascade,
  relation text not null check (relation in ('supersedes', 'conflicts')),
  reason text not null default '',
  status text not null default 'open' check (status in ('open', 'accepted', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (decision_id, earlier_decision_id),
  check (decision_id <> earlier_decision_id)
);

create index if not exists decision_conflicts_workspace_open_idx
  on public.decision_conflicts (workspace_id) where status = 'open';

alter table public.decision_conflicts enable row level security;

-- Both decisions must live in the conflict's workspace; ids are global, so
-- without this a member could attach alerts to another workspace's records.
create policy "members can read decision conflicts"
  on public.decision_conflicts for select using (public.is_workspace_member(workspace_id));
create policy "members can insert decision conflicts"
  on public.decision_conflicts for insert with check (
    public.is_workspace_member(workspace_id)
    and exists (select 1 from public.decision_records d where d.id = decision_id and d.workspace_id = decision_conflicts.workspace_id)
    and exists (select 1 from public.decision_records d where d.id = earlier_decision_id and d.workspace_id = decision_conflicts.workspace_id)
  );
create policy "members can update decision conflicts"
  on public.decision_conflicts for update
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy "members can delete decision conflicts"
  on public.decision_conflicts for delete using (public.is_workspace_member(workspace_id));

grant select, insert, update, delete on public.decision_conflicts to authenticated;

-- superseded_by must also stay inside the workspace. Checked by trigger
-- because the existing update policy on decision_records only guards note_id.
create or replace function public.guard_decision_superseded_by()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.superseded_by is not null and not exists (
    select 1 from public.decision_records d
    where d.id = new.superseded_by and d.workspace_id = new.workspace_id
  ) then
    raise exception 'superseded_by must reference a decision in the same workspace';
  end if;
  return new;
end;
$$;

create trigger decision_records_superseded_by_guard
  before insert or update of superseded_by on public.decision_records
  for each row execute procedure public.guard_decision_superseded_by();

notify pgrst, 'reload schema';
