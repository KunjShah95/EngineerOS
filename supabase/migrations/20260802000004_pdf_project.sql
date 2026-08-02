-- EngineerOS — PDF documents can belong to a project (for project filtering).
-- Run after 20260802000002_group_b.sql.

alter table public.pdf_documents
  add column project_id uuid references public.projects (id) on delete set null;

create index pdf_documents_workspace_project_idx
  on public.pdf_documents (workspace_id, project_id);
