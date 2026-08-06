-- Note attachments: files attached to a note (stored in the private "attachments" bucket).
create table public.note_attachments (
  id            uuid primary key default gen_random_uuid(),
  note_id       uuid not null references public.notes(id) on delete cascade,
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  name          text not null,
  storage_path  text not null,
  mime_type     text,
  size_bytes    bigint,
  created_at    timestamptz not null default now()
);

alter table public.note_attachments enable row level security;

create policy "members can read attachments"
  on public.note_attachments for select using (
    exists (
      select 1 from public.notes n
      where n.id = note_id and public.is_workspace_member(n.workspace_id)
    )
  );
create policy "members can insert attachments"
  on public.note_attachments for insert with check (
    exists (
      select 1 from public.notes n
      where n.id = note_id and public.is_workspace_member(n.workspace_id)
    )
  );
create policy "members can delete attachments"
  on public.note_attachments for delete using (
    exists (
      select 1 from public.notes n
      where n.id = note_id and public.is_workspace_member(n.workspace_id)
    )
  );

create index if not exists note_attachments_note_idx
  on public.note_attachments (note_id, created_at desc);

-- Storage bucket for attachments — private; object paths are scoped by user id.
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

create policy "authenticated users can upload attachments"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "authenticated users can read own attachments"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "authenticated users can delete own attachments"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
