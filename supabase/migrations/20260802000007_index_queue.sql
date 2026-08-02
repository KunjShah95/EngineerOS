-- EngineerOS — automatic background indexing (index queue)
-- Run after 20260802000006_rag_assistant.sql.
--
-- Every entity that feeds the embeddings table (notes, tasks, resources,
-- daily notes, PDFs) is enqueued on insert/update/delete by a trigger. A
-- client-side drain (useAutoIndex hook + the assistant route) processes the
-- queue by re-embedding changed rows and clearing stale embeddings.

create table public.index_queue (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  entity_type public.embedding_entity not null,
  entity_id uuid not null,
  action text not null default 'upsert' check (action in ('upsert', 'delete')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, entity_type, entity_id)
);

create index index_queue_workspace_created_idx
  on public.index_queue (workspace_id, created_at);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- One shared trigger function keyed off TG_TABLE_NAME, security definer so the
-- enqueue write bypasses RLS (the queue is system-internal).
create or replace function public.enqueue_index_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_entity_type public.embedding_entity;
  v_entity_id uuid;
  v_workspace_id uuid;
  v_action text;
begin
  if tg_op = 'DELETE' then
    v_entity_id := old.id;
    v_workspace_id := old.workspace_id;
    v_action := 'delete';
  else
    v_entity_id := new.id;
    v_workspace_id := new.workspace_id;
    v_action := 'upsert';
  end if;

  v_entity_type := case tg_table_name
    when 'notes' then 'note'::public.embedding_entity
    when 'tasks' then 'task'::public.embedding_entity
    when 'resources' then 'resource'::public.embedding_entity
    when 'daily_notes' then 'daily_note'::public.embedding_entity
    when 'pdf_documents' then 'pdf'::public.embedding_entity
  end;

  insert into public.index_queue (workspace_id, entity_type, entity_id, action)
  values (v_workspace_id, v_entity_type, v_entity_id, v_action)
  on conflict (workspace_id, entity_type, entity_id)
  do update set action = v_action, created_at = now();

  return coalesce(new, old);
end;
$$;

create trigger notes_enqueue_index
  after insert or update or delete on public.notes
  for each row execute procedure public.enqueue_index_change();

create trigger tasks_enqueue_index
  after insert or update or delete on public.tasks
  for each row execute procedure public.enqueue_index_change();

create trigger resources_enqueue_index
  after insert or update or delete on public.resources
  for each row execute procedure public.enqueue_index_change();

create trigger daily_notes_enqueue_index
  after insert or update or delete on public.daily_notes
  for each row execute procedure public.enqueue_index_change();

create trigger pdf_documents_enqueue_index
  after insert or update or delete on public.pdf_documents
  for each row execute procedure public.enqueue_index_change();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Members may only read their own workspace's queue; the drain route runs as
-- the signed-in user, so RLS scopes it correctly. Writes are handled by the
-- security-definer trigger above (no insert/update policy needed), but the
-- drain route deletes processed rows as the signed-in user, so it needs its
-- own delete policy.
alter table public.index_queue enable row level security;

create policy "members can read index queue"
  on public.index_queue for select using (public.is_workspace_member(workspace_id));

create policy "members can delete index queue"
  on public.index_queue for delete using (public.is_workspace_member(workspace_id));
