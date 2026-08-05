-- Prevent duplicate tasks with same title+status+due_date within a workspace.
-- Partial unique index excludes soft-deleted rows so deleted tasks don't block re-creation.
create unique index tasks_dedup_idx
  on public.tasks (workspace_id, title, status, due_date)
  where deleted_at is null;
