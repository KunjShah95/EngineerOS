-- Sprint 3 — task dependencies + activity history
-- ============================================================

-- task_dependencies: "task_id depends on depends_on_task_id"
create table public.task_dependencies (
  task_id             uuid not null references public.tasks(id) on delete cascade,
  depends_on_task_id  uuid not null references public.tasks(id) on delete cascade,
  created_at          timestamptz not null default now(),
  primary key (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id)
);

alter table public.task_dependencies enable row level security;

create policy "members can read task_dependencies"
  on public.task_dependencies for select using (
    exists (
      select 1 from public.tasks t
      where t.id = task_id and public.is_workspace_member(t.workspace_id)
    )
  );
create policy "members can insert task_dependencies"
  on public.task_dependencies for insert with check (
    exists (
      select 1 from public.tasks t
      where t.id = task_id and public.is_workspace_member(t.workspace_id)
    )
  );
create policy "members can delete task_dependencies"
  on public.task_dependencies for delete using (
    exists (
      select 1 from public.tasks t
      where t.id = task_id and public.is_workspace_member(t.workspace_id)
    )
  );

create index task_dependencies_depends_idx
  on public.task_dependencies (depends_on_task_id);

-- ============================================================
-- task_activity — append-only history feed per task
-- ============================================================
create table public.task_activity (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null references public.tasks(id) on delete cascade,
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  action        text not null,          -- created | updated | comment_added | dependency_added | dependency_removed
  metadata      jsonb not null default '{}',
  created_at    timestamptz not null default now()
);

alter table public.task_activity enable row level security;

create policy "members can read task_activity"
  on public.task_activity for select using (public.is_workspace_member(workspace_id));
create policy "members can insert task_activity"
  on public.task_activity for insert with check (public.is_workspace_member(workspace_id));

create index task_activity_task_idx
  on public.task_activity (task_id, created_at desc);

-- ============================================================
-- Triggers — the history writes itself; no app changes needed
-- ============================================================

-- Task created
create or replace function public.log_task_created()
returns trigger
language plpgsql
as $$
begin
  insert into public.task_activity (task_id, workspace_id, action, metadata)
  values (new.id, new.workspace_id, 'created', jsonb_build_object('status', new.status));
  return new;
end;
$$;
create trigger tasks_created
  after insert on public.tasks
  for each row execute procedure public.log_task_created();

-- Field changes (status, priority, due date, project, estimate, title).
-- Deliberately excludes `position`/`updated_at` so drag-and-drop reorders
-- don't spam the feed.
create or replace function public.log_task_updated()
returns trigger
language plpgsql
as $$
declare
  changes jsonb := '{}'::jsonb;
begin
  if new.title is distinct from old.title then
    changes := changes || jsonb_build_object('title', jsonb_build_object('from', old.title, 'to', new.title));
  end if;
  if new.status is distinct from old.status then
    changes := changes || jsonb_build_object('status', jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  if new.priority is distinct from old.priority then
    changes := changes || jsonb_build_object('priority', jsonb_build_object('from', old.priority, 'to', new.priority));
  end if;
  if new.due_date is distinct from old.due_date then
    changes := changes || jsonb_build_object('due_date', jsonb_build_object('from', old.due_date, 'to', new.due_date));
  end if;
  if new.project_id is distinct from old.project_id then
    changes := changes || jsonb_build_object('project', jsonb_build_object('from', old.project_id, 'to', new.project_id));
  end if;
  if new.estimate is distinct from old.estimate then
    changes := changes || jsonb_build_object('estimate', jsonb_build_object('from', old.estimate, 'to', new.estimate));
  end if;

  if changes <> '{}'::jsonb then
    insert into public.task_activity (task_id, workspace_id, action, metadata)
    values (new.id, new.workspace_id, 'updated', changes);
  end if;
  return new;
end;
$$;
create trigger tasks_updated
  before update on public.tasks
  for each row execute procedure public.log_task_updated();

-- Comment added
create or replace function public.log_task_comment()
returns trigger
language plpgsql
as $$
begin
  insert into public.task_activity (task_id, workspace_id, action, metadata)
  values (new.task_id, new.workspace_id, 'comment_added', jsonb_build_object('comment_id', new.id));
  return new;
end;
$$;
create trigger task_comments_activity
  after insert on public.task_comments
  for each row execute procedure public.log_task_comment();

-- Dependency added / removed
create or replace function public.log_task_dependency()
returns trigger
language plpgsql
as $$
begin
  insert into public.task_activity (task_id, workspace_id, action, metadata)
  values (new.task_id, new.workspace_id, 'dependency_added', jsonb_build_object('depends_on', new.depends_on_task_id));
  return new;
end;
$$;
create trigger task_dependencies_added
  after insert on public.task_dependencies
  for each row execute procedure public.log_task_dependency();

create or replace function public.log_task_dependency_removed()
returns trigger
language plpgsql
as $$
declare
  ws uuid;
begin
  select workspace_id into ws from public.tasks where id = old.task_id;
  -- The parent task may already be cascade-deleted; skip logging then.
  if ws is null then return old; end if;
  insert into public.task_activity (task_id, workspace_id, action, metadata)
  values (old.task_id, ws, 'dependency_removed', jsonb_build_object('depends_on', old.depends_on_task_id));
  return old;
end;
$$;
create trigger task_dependencies_removed
  after delete on public.task_dependencies
  for each row execute procedure public.log_task_dependency_removed();
