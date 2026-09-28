-- EngineerOS — capture merged pull requests as decision notes.
--
-- The reasoning behind a change usually lives in its PR description, which
-- nobody copies anywhere. The GitHub webhook (/api/github/webhook) turns each
-- merged PR into a note so the "why" becomes searchable without manual filing.

-- Link a note back to the GitHub object it was created from (PR html_url).
-- Unique per workspace so webhook redeliveries can't create duplicates; NULLs
-- are distinct, so hand-written notes are unaffected. Not partial: PostgREST's
-- on_conflict needs a plain unique index to target. A soft-deleted PR note
-- therefore stays deleted on redelivery, which is the behavior we want.
alter table public.notes
  add column if not exists source_url text;

create unique index if not exists notes_workspace_source_url_idx
  on public.notes (workspace_id, source_url);

-- Which repositories a workspace captures PRs from. Explicit opt-in: the
-- webhook is shared across workspaces, so without this a PR from any repo
-- would have nowhere (or everywhere) to land.
create table if not exists public.github_repo_links (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- Stored lowercased; GitHub owner/repo names are case-insensitive.
  repo_full_name text not null check (repo_full_name = lower(repo_full_name)),
  capture_prs boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (workspace_id, repo_full_name)
);

-- Webhook lookup is by repo across all workspaces.
create index if not exists github_repo_links_repo_idx
  on public.github_repo_links (repo_full_name) where capture_prs;

alter table public.github_repo_links enable row level security;

-- No insert/update policy on purpose. A link makes the shared webhook write a
-- repo's PR descriptions into this workspace, so it must only exist when the
-- workspace's GitHub token can actually read that repo. Otherwise anyone could
-- link "someco/private-repo" by name and receive its PRs once someco points a
-- webhook here. /api/github/repo-links verifies access with the GitHub API and
-- inserts with the service role.
create policy "members can read repo links"
  on public.github_repo_links for select using (public.is_workspace_member(workspace_id));
create policy "members can delete repo links"
  on public.github_repo_links for delete using (public.is_workspace_member(workspace_id));

-- Explicit grants: default privileges aren't guaranteed for `db push` tables
-- (see 20260915000001_workspace_members_grants.sql).
grant select, delete on public.github_repo_links to authenticated;

notify pgrst, 'reload schema';
