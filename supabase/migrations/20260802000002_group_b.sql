-- EngineerOS — Group B "Could Have" features
-- GitHub integration, voice notes, AI summaries, PDF chat.
-- Run this AFTER 20260802000001_init.sql in the Supabase SQL editor.

-- ============================================================
-- ENUMS
-- ============================================================
create type public.integration_provider as enum ('github');

-- ============================================================
-- TASKS: source_url for GitHub-imported issues
-- ============================================================
alter table public.tasks
  add column source_url text;

-- ============================================================
-- INTEGRATIONS (connected third-party accounts)
-- ============================================================
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider public.integration_provider not null default 'github',
  provider_user_id text not null,
  username text,
  avatar_url text,
  access_token text not null,
  scopes text[],
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider)
);

create trigger integrations_touch
  before update on public.integrations
  for each row execute procedure public.touch_updated_at();

-- ============================================================
-- VOICE NOTES
-- ============================================================
create table public.voice_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  note_id uuid references public.notes (id) on delete set null,
  storage_path text not null,
  duration_ms integer not null default 0,
  transcript text,
  status text not null default 'recorded', -- recorded | transcribing | transcribed | failed
  created_at timestamptz not null default now()
);

create index voice_notes_note_idx on public.voice_notes (note_id);

-- ============================================================
-- AI SUMMARIES (cached per entity)
-- ============================================================
create type public.summary_entity as enum ('note', 'task', 'daily_note');

create table public.ai_summaries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  entity_type public.summary_entity not null,
  entity_id uuid not null,
  summary text not null,
  model text not null default 'local-extractive',
  created_at timestamptz not null default now(),
  unique (workspace_id, entity_type, entity_id)
);

-- ============================================================
-- PDF DOCUMENTS (for PDF chat)
-- ============================================================
create table public.pdf_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null,
  storage_path text,
  text_content text not null default '',
  char_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- RLS
-- ============================================================

-- integrations
alter table public.integrations enable row level security;

create policy "members can read integrations"
  on public.integrations for select using (public.is_workspace_member(workspace_id));
create policy "members can insert integrations"
  on public.integrations for insert with check (public.is_workspace_member(workspace_id));
create policy "members can update integrations"
  on public.integrations for update using (public.is_workspace_member(workspace_id));
create policy "members can delete integrations"
  on public.integrations for delete using (public.is_workspace_member(workspace_id));

-- voice_notes
alter table public.voice_notes enable row level security;

create policy "members can read voice notes"
  on public.voice_notes for select using (public.is_workspace_member(workspace_id));
create policy "members can insert voice notes"
  on public.voice_notes for insert with check (public.is_workspace_member(workspace_id));
create policy "members can update voice notes"
  on public.voice_notes for update using (public.is_workspace_member(workspace_id));
create policy "members can delete voice notes"
  on public.voice_notes for delete using (public.is_workspace_member(workspace_id));

-- ai_summaries
alter table public.ai_summaries enable row level security;

create policy "members can read summaries"
  on public.ai_summaries for select using (public.is_workspace_member(workspace_id));
create policy "members can insert summaries"
  on public.ai_summaries for insert with check (public.is_workspace_member(workspace_id));
create policy "members can update summaries"
  on public.ai_summaries for update using (public.is_workspace_member(workspace_id));
create policy "members can delete summaries"
  on public.ai_summaries for delete using (public.is_workspace_member(workspace_id));

-- pdf_documents
alter table public.pdf_documents enable row level security;

create policy "members can read pdfs"
  on public.pdf_documents for select using (public.is_workspace_member(workspace_id));
create policy "members can insert pdfs"
  on public.pdf_documents for insert with check (public.is_workspace_member(workspace_id));
create policy "members can update pdfs"
  on public.pdf_documents for update using (public.is_workspace_member(workspace_id));
create policy "members can delete pdfs"
  on public.pdf_documents for delete using (public.is_workspace_member(workspace_id));

-- ============================================================
-- STORAGE (private buckets: voice-notes, pdfs)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('voice-notes', 'voice-notes', false),
       ('pdfs', 'pdfs', false)
on conflict (id) do nothing;

create policy "authenticated users can upload voice notes"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'voice-notes'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "authenticated users can read voice notes"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'voice-notes'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "authenticated users can delete voice notes"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'voice-notes'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "authenticated users can upload pdfs"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'pdfs'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "authenticated users can read pdfs"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'pdfs'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "authenticated users can delete pdfs"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'pdfs'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
