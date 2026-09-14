-- EngineerOS — SaaS tenancy: plans, real membership, invites
-- Source of truth: docs/planning/SAAS_ROADMAP.md
-- Run after 20260901000000_embedding_provenance.sql.
--
-- Three changes, one of which converts the whole schema to multi-tenant:
--
--   1. workspaces gains `plan` (+ onboarding/trial bookkeeping). A subscription
--      is a property of the workspace, so it lives here and nowhere else.
--   2. workspace_members makes `is_workspace_member()` mean what its name
--      always promised. Every RLS policy in the schema already calls that one
--      function, so redefining it is the entire multi-tenant migration — no
--      policy in any other table needs to change.
--   3. workspace_invites holds pending invitations. Email delivery is optional;
--      an invite is usable as a share link with or without Resend configured.
--
-- The recursion trap: `workspace_members` has a policy that calls
-- `is_workspace_member()`, which reads `workspace_members`. That is safe only
-- because the function is `security definer` — its inner SELECT runs as the
-- function owner and bypasses the table's own RLS. This is the same pattern
-- `note_tags` / `task_notes` already use to scope through their parent row.

-- ============================================================
-- ENUMS
-- ============================================================

create type public.workspace_plan as enum ('free', 'pro', 'team');
-- `viewer` is stored but not yet enforced: every member can currently write.
-- Read-only collaborators need a per-table policy sweep (see SAAS_ROADMAP S4),
-- which is deliberately not tangled into a migration this size.
create type public.workspace_role as enum ('owner', 'editor', 'viewer');

-- ============================================================
-- WORKSPACES — plan + lifecycle
-- ============================================================

-- Existing rows get 'free' by default. Nothing is enforced until an operator
-- applies this migration, which is exactly the moment billing becomes real;
-- before it, src/lib/saas/plans.ts sees no `plan` column and enforces nothing.
alter table public.workspaces
  add column if not exists plan public.workspace_plan not null default 'free',
  add column if not exists trial_ends_at timestamptz,
  add column if not exists onboarded_at timestamptz;

create index workspaces_owner_idx on public.workspaces (owner_id) where deleted_at is null;

-- ============================================================
-- MEMBERSHIP
-- ============================================================

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role public.workspace_role not null default 'editor',
  invited_by uuid references public.users (id) on delete set null,
  joined_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index workspace_members_user_idx on public.workspace_members (user_id);
create index workspace_members_workspace_idx on public.workspace_members (workspace_id);

-- The owner is a member. Enforced by trigger rather than by trusting each
-- insert path, because workspaces are created by the signup trigger, which runs
-- before any client could add the row itself.
create or replace function public.add_workspace_owner_as_member()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (workspace_id, user_id) do nothing;
  return new;
end;
$$;

create trigger workspaces_add_owner_member
  after insert on public.workspaces
  for each row execute procedure public.add_workspace_owner_as_member();

-- Backfill workspaces created before this migration.
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, w.owner_id, 'owner'
from public.workspaces w
where w.deleted_at is null
on conflict (workspace_id, user_id) do nothing;

-- ============================================================
-- TENANCY FUNCTIONS
-- ============================================================

-- Redefine the function every policy in the schema already depends on.
--
-- The owner_id branch is kept on purpose: if the backfill or the trigger ever
-- misses a row, the owner must still be able to read their own workspace. Failing
-- closed here would mean data loss from the user's point of view.
create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid()
  )
  or exists (
    select 1 from public.workspaces w
    where w.id = ws and w.owner_id = auth.uid()
  );
$$;

-- Owner-only: who may manage members, invites, plan and deletion.
create or replace function public.is_workspace_owner(ws uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid() and m.role = 'owner'
  )
  or exists (
    select 1 from public.workspaces w
    where w.id = ws and w.owner_id = auth.uid()
  );
$$;

-- The caller's role in a workspace, for UI affordances and (later) enforcement.
create or replace function public.workspace_member_role(ws uuid)
returns public.workspace_role
language sql
stable
security definer set search_path = public
as $$
  select coalesce(
    (select m.role from public.workspace_members m
      where m.workspace_id = ws and m.user_id = auth.uid()
      limit 1),
    case when exists (
      select 1 from public.workspaces w
      where w.id = ws and w.owner_id = auth.uid()
    ) then 'owner'::public.workspace_role end
  );
$$;

-- How many workspaces this account owns — the workspace-count limit needs it,
-- and counting client-side would let anyone read past their own membership.
create or replace function public.count_owned_workspaces()
returns bigint
language sql
stable
security definer set search_path = public
as $$
  select count(*) from public.workspaces
  where owner_id = auth.uid() and deleted_at is null;
$$;

-- Platform-funded AI used this calendar month.
--
-- Counts over chat_messages joined to threads, and is security definer so the
-- caller sees an accurate number regardless of which threads they can read.
-- Returns 0 (not null) when the tenancy feature is unused so the caller never
-- has to distinguish "no usage" from "query failed".
create or replace function public.ai_usage_this_month(p_workspace uuid)
returns bigint
language sql
stable
security definer set search_path = public
as $$
  select count(*)
  from public.chat_messages m
  join public.chat_threads t on t.id = m.thread_id
  where t.workspace_id = p_workspace
    and t.deleted_at is null
    and m.role = 'user'
    and m.created_at >= date_trunc('month', now());
$$;

-- ============================================================
-- INVITES
-- ============================================================

create table public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null,
  role public.workspace_role not null default 'editor',
  -- Shareable secret. Generated here so an invite is valid the instant it's
  -- inserted, even when no email provider is configured.
  --
  -- Built only from core functions: pgcrypto's gen_random_bytes() lives in the
  -- `extensions` schema, which is not on the default search_path, so using it in
  -- a column default would fail the migration. gen_random_uuid() carries the
  -- entropy and is native to Postgres 13+.
  token text not null unique
    default md5(random()::text || clock_timestamp()::text || gen_random_uuid()::text),
  invited_by uuid references public.users (id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  unique (workspace_id, email)
);

create index workspace_invites_workspace_idx on public.workspace_invites (workspace_id);
create index workspace_invites_email_idx on public.workspace_invites (lower(email))
  where accepted_at is null;

-- Accepting an invite is a join, so the membership row must exist. Kept in SQL
-- rather than duplicated in the route so there is one definition of "joined".
create or replace function public.accept_workspace_invite(p_token text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_invite public.workspace_invites%rowtype;
  v_email text;
begin
  v_email := lower((select email from public.users where id = auth.uid()));
  if v_email is null then
    v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  end if;
  if v_email = '' then
    raise exception 'not authenticated';
  end if;

  select * into v_invite
  from public.workspace_invites
  where token = p_token
    and accepted_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'invite not found or expired';
  end if;

  if lower(v_invite.email) <> v_email then
    raise exception 'this invite was sent to a different address';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role, invited_by)
  values (v_invite.workspace_id, auth.uid(), v_invite.role, v_invite.invited_by)
  on conflict (workspace_id, user_id) do update set role = excluded.role;

  update public.workspace_invites
  set accepted_at = now()
  where id = v_invite.id;

  return v_invite.workspace_id;
end;
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.workspace_members enable row level security;

-- Members may see who else is in the workspace; that is what a team is.
create policy "members can read workspace members"
  on public.workspace_members for select using (public.is_workspace_member(workspace_id));
-- Only an owner may add or change people. Removal is covered separately, so a
-- member can always leave without waiting for an owner.
create policy "owners can insert workspace members"
  on public.workspace_members for insert with check (public.is_workspace_owner(workspace_id));
create policy "owners can update workspace members"
  on public.workspace_members for update using (public.is_workspace_owner(workspace_id));
create policy "owners can delete workspace members"
  on public.workspace_members for delete using (public.is_workspace_owner(workspace_id));

-- A user can always remove themselves (leave a workspace they joined).
create policy "anyone can leave a workspace"
  on public.workspace_members for delete
  using (user_id = auth.uid() and role <> 'owner');

alter table public.workspace_invites enable row level security;

create policy "owners can read invites"
  on public.workspace_invites for select using (public.is_workspace_owner(workspace_id));
create policy "owners can create invites"
  on public.workspace_invites for insert with check (public.is_workspace_owner(workspace_id));
create policy "owners can revoke invites"
  on public.workspace_invites for delete using (public.is_workspace_owner(workspace_id));

-- workspaces: a member must be able to *see* a workspace they were invited to,
-- which the original owner-only select policy does not allow. Write stays
-- owner-only — an editor changes content, not the workspace's identity or plan.
drop policy if exists "owner can read own workspaces" on public.workspaces;
create policy "members can read their workspaces"
  on public.workspaces for select using (public.is_workspace_member(id));

-- ============================================================
-- GRANTS
-- ============================================================

-- The routes call these as the signed-in user through the anon/authenticated
-- roles; without execute they fail with 42883 and the UI sees an empty state.
grant execute on function public.workspace_member_role(uuid) to authenticated, anon;
grant execute on function public.is_workspace_member(uuid) to authenticated, anon;
grant execute on function public.is_workspace_owner(uuid) to authenticated, anon;
grant execute on function public.count_owned_workspaces to authenticated;
grant execute on function public.ai_usage_this_month(uuid) to authenticated;
grant execute on function public.accept_workspace_invite(text) to authenticated;
