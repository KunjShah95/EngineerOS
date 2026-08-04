-- EngineerOS — scale indexes (10 → 100 users)
-- Run after 20260802000012_embedding_entity_project.sql.
--
-- Notes/tasks/resources already have workspace-scoped composite indexes
-- (notes_workspace_pinned_idx, tasks_workspace_status_position_idx,
-- resources_workspace_kind_idx) and daily_notes already has a unique
-- (workspace_id, date) constraint. This adds the missing workspace-scoped
-- indexes plus the date/range handles used by the structured Q&A
-- ("what did I do last week?") and due-task queries.

create index if not exists tasks_workspace_created_at_idx
  on public.tasks (workspace_id, created_at);

create index if not exists tasks_workspace_completed_at_idx
  on public.tasks (workspace_id, completed_at);

create index if not exists tasks_workspace_due_idx
  on public.tasks (workspace_id, due_date);

create index if not exists projects_workspace_idx
  on public.projects (workspace_id);

create index if not exists pdf_documents_workspace_idx
  on public.pdf_documents (workspace_id);
