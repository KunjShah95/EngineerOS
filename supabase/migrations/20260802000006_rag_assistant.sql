-- EngineerOS — Phase 8b: workspace Q&A / RAG assistant (persisted conversations)
-- Run after 20260802000005_semantic_search.sql.

-- ============================================================
-- CHAT THREADS + MESSAGES
-- ============================================================

create type public.chat_role as enum ('user', 'assistant');

create table public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index chat_threads_workspace_idx
  on public.chat_threads (workspace_id, updated_at desc);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  role public.chat_role not null,
  content text not null,
  -- JSON array of { entity_type, entity_id, title, href, score } citations.
  sources jsonb not null default '[]'::jsonb,
  model text,
  created_at timestamptz not null default now()
);

create index chat_messages_thread_idx
  on public.chat_messages (thread_id, created_at);

-- ============================================================
-- TRIGGERS
-- ============================================================

create trigger chat_threads_touch
  before update on public.chat_threads
  for each row execute procedure public.touch_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.chat_threads enable row level security;

create policy "members can read chat threads"
  on public.chat_threads for select using (public.is_workspace_member(workspace_id));
create policy "members can insert chat threads"
  on public.chat_threads for insert with check (public.is_workspace_member(workspace_id));
create policy "members can update chat threads"
  on public.chat_threads for update using (public.is_workspace_member(workspace_id));
create policy "members can delete chat threads"
  on public.chat_threads for delete using (public.is_workspace_member(workspace_id));

alter table public.chat_messages enable row level security;

create policy "members can read chat messages"
  on public.chat_messages for select using (
    exists (
      select 1 from public.chat_threads t
      where t.id = thread_id and public.is_workspace_member(t.workspace_id)
    )
  );
create policy "members can insert chat messages"
  on public.chat_messages for insert with check (
    exists (
      select 1 from public.chat_threads t
      where t.id = thread_id and public.is_workspace_member(t.workspace_id)
    )
  );
create policy "members can update chat messages"
  on public.chat_messages for update using (
    exists (
      select 1 from public.chat_threads t
      where t.id = thread_id and public.is_workspace_member(t.workspace_id)
    )
  );
create policy "members can delete chat messages"
  on public.chat_messages for delete using (
    exists (
      select 1 from public.chat_threads t
      where t.id = thread_id and public.is_workspace_member(t.workspace_id)
    )
  );
