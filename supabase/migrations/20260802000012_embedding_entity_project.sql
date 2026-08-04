-- EngineerOS — add 'project' to embedding_entity enum
-- Run after 20260802000011_ai_configs.sql.
--
-- workspace-qa.ts produces ChatSource objects with entity_type = 'project' for
-- citations sourced from the projects table. These are stored in
-- chat_messages.sources (JSONB — no enum constraint) so no existing rows are
-- broken. However the TypeScript EmbeddingEntity type already includes
-- "project" and keeping the DB enum in sync prevents future breakage if any
-- code tries to write a project-typed row into the embeddings or index_queue
-- tables.
--
-- ALTER TYPE … ADD VALUE is not transactional in PostgreSQL; the DO block
-- guard makes the migration idempotent.

do $$ begin
  alter type public.embedding_entity add value 'project';
exception when duplicate_object then null;
end $$;
