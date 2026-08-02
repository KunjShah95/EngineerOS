-- EngineerOS — Phase 9: Knowledge Graph (note_links)
-- Run after 20260802000007_index_queue.sql.
--
-- The docs' DATABASE_PLAN called task_notes "the seed of Phase 9's knowledge
-- graph ... plus a future note_notes self-referential join table". This is
-- that table: a directed note→note link that powers explicit backlinks.
-- Direction is authored: note_id links TO linked_note_id, so the backlink
-- query for a note is "rows where linked_note_id = <note>". Wikilinks
-- ([[Title]] in markdown) are resolved at read time by the graph layer and
-- do NOT need persistence; note_links is the explicit, curated version.

create table public.note_links (
  note_id uuid not null references public.notes (id) on delete cascade,
  linked_note_id uuid not null references public.notes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (note_id, linked_note_id),
  -- No self-links.
  check (note_id <> linked_note_id)
);

-- Backlink lookups scan the target column, so index it.
create index note_links_linked_idx on public.note_links (linked_note_id, note_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- Scoped through BOTH endpoints: a link is visible/writable only when the
-- source note AND the linked note both live in the caller's workspace. The
-- target-side check is what stops a member from linking their note to another
-- workspace's note and leaking that note's title/id into their own graph.

alter table public.note_links enable row level security;

create policy "members can read note_links"
  on public.note_links for select using (
    exists (
      select 1 from public.notes n
      where n.id = note_id and public.is_workspace_member(n.workspace_id)
    )
    and exists (
      select 1 from public.notes t
      where t.id = linked_note_id and public.is_workspace_member(t.workspace_id)
    )
  );

create policy "members can insert note_links"
  on public.note_links for insert with check (
    exists (
      select 1 from public.notes n
      where n.id = note_id and public.is_workspace_member(n.workspace_id)
    )
    and exists (
      select 1 from public.notes t
      where t.id = linked_note_id and public.is_workspace_member(t.workspace_id)
    )
  );

create policy "members can delete note_links"
  on public.note_links for delete using (
    exists (
      select 1 from public.notes n
      where n.id = note_id and public.is_workspace_member(n.workspace_id)
    )
    and exists (
      select 1 from public.notes t
      where t.id = linked_note_id and public.is_workspace_member(t.workspace_id)
    )
  );
