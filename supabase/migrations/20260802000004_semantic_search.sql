-- EngineerOS — Phase 8a Semantic Search
-- pgvector extension (IF NOT EXISTS so it is idempotent across hosts)
create extension if not exists vector;

create type public.embedding_entity as enum ('note', 'task', 'resource', 'daily_note', 'pdf');

create table public.embeddings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  entity_type public.embedding_entity not null,
  entity_id uuid not null,
  kind text,
  chunk_index int not null default 0,
  content text not null,
  embedding vector(1536) not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, entity_type, entity_id, chunk_index)
);

create index embeddings_workspace_idx on public.embeddings (workspace_id, entity_type, entity_id);

-- HNSW index so retrieval is fast and approximate; keep it filtered by workspace.
create index embeddings_hnsw_idx on public.embeddings
  using hnsw (embedding vector_cosine_ops);

alter table public.embeddings enable row level security;

create policy "members can read embeddings" on public.embeddings
  for select using (public.is_workspace_member(workspace_id));
create policy "members can insert embeddings" on public.embeddings
  for insert with check (public.is_workspace_member(workspace_id));
create policy "members can update embeddings" on public.embeddings
  for update using (public.is_workspace_member(workspace_id));
create policy "members can delete embeddings" on public.embeddings
  for delete using (public.is_workspace_member(workspace_id));

create or replace function public.semantic_search(
  q_workspace uuid,
  q_embedding vector(1536),
  q_limit int default 12
) returns table (
  entity_type public.embedding_entity,
  entity_id uuid,
  chunk_index int,
  content text,
  score float
) language sql
security invoker
as $fn$
  select e.entity_type, e.entity_id, e.chunk_index, e.content,
         1 - (e.embedding <=> q_embedding) as score
  from public.embeddings e
  where e.workspace_id = q_workspace
  order by e.embedding <=> q_embedding
  limit q_limit;
$fn$;