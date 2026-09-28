-- EngineerOS — decision records.
--
-- A structured "why" pulled out of a note: what was decided, the context that
-- forced it, the options rejected and the trade-offs accepted. Extracted by AI
-- from merged-PR notes automatically (GitHub webhook) and from any note on
-- request, so nobody has to write an ADR by hand.
--
-- One record per note: re-extraction replaces it. Deleting the note deletes
-- the record — the note is the evidence, the record is a derived view of it.

create table if not exists public.decision_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  note_id uuid not null unique references public.notes (id) on delete cascade,
  title text not null,
  decision text not null,
  context text not null default '',
  -- [{ "option": "...", "rejected_because": "..." }]
  alternatives jsonb not null default '[]'::jsonb check (jsonb_typeof(alternatives) = 'array'),
  consequences text not null default '',
  revisit_when text not null default '',
  -- Copied from the note (merged PR URL) so the list can link out without a join.
  source_url text,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists decision_records_workspace_created_idx
  on public.decision_records (workspace_id, created_at desc);

create trigger decision_records_touch
  before update on public.decision_records
  for each row execute procedure public.touch_updated_at();

alter table public.decision_records enable row level security;

-- Members may read and correct records (fix a wrong summary, delete a
-- non-decision); the extraction route writes as the signed-in user.
-- Writes must also point at a note in the same workspace: note_id is unique
-- and not workspace-scoped, so otherwise a member could claim another
-- workspace's note_id and block its extraction.
create policy "members can read decision records"
  on public.decision_records for select using (public.is_workspace_member(workspace_id));
create policy "members can insert decision records"
  on public.decision_records for insert with check (
    public.is_workspace_member(workspace_id)
    and exists (select 1 from public.notes n where n.id = note_id and n.workspace_id = decision_records.workspace_id)
  );
create policy "members can update decision records"
  on public.decision_records for update
  using (public.is_workspace_member(workspace_id))
  with check (
    public.is_workspace_member(workspace_id)
    and exists (select 1 from public.notes n where n.id = note_id and n.workspace_id = decision_records.workspace_id)
  );
create policy "members can delete decision records"
  on public.decision_records for delete using (public.is_workspace_member(workspace_id));

-- Explicit grants: default privileges aren't guaranteed for `db push` tables
-- (see 20260915000001_workspace_members_grants.sql).
grant select, insert, update, delete on public.decision_records to authenticated;

notify pgrst, 'reload schema';
