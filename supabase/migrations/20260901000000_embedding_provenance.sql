-- Embedding provenance.
--
-- Vectors from different embedding models are not comparable. Providers also
-- return different dimensions (Gemini 768, Mistral 1024, OpenAI 1536), and the
-- indexer zero-pads to the vector(1536) column width. Padding preserves cosine
-- ordering *within* one provider but says nothing across providers.
--
-- Without provenance, switching providers silently produces an index where old
-- and new rows sit in incomparable spaces: search keeps returning results, they
-- are just quietly wrong. Recording the model makes that state detectable and
-- lets a re-index target only the stale rows.

alter table public.embeddings
  add column if not exists embedding_model text;

comment on column public.embeddings.embedding_model is
  'Provider and model that produced this vector, e.g. "openai:text-embedding-3-small". '
  'Rows whose model differs from the workspace''s current model are stale and must '
  'be re-indexed before their scores can be trusted against fresh rows.';

-- Existing rows predate provenance tracking. Marking them unknown (rather than
-- guessing) means the staleness check below reports them, which is the honest
-- outcome: we genuinely do not know what produced them.
update public.embeddings
  set embedding_model = 'unknown'
  where embedding_model is null;

-- Partial index: staleness checks filter on model, and the common query shape
-- is "rows in this workspace not matching the current model".
create index if not exists embeddings_workspace_model_idx
  on public.embeddings (workspace_id, embedding_model);

/**
 * Report how much of a workspace's index is stale with respect to a model.
 * Returns one row per distinct model so a partially-migrated index is visible
 * rather than hidden behind a single boolean.
 */
create or replace function public.embedding_index_health(
  q_workspace uuid,
  q_current_model text
)
returns table (
  embedding_model text,
  chunk_count bigint,
  is_current boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    e.embedding_model,
    count(*) as chunk_count,
    e.embedding_model is not distinct from q_current_model as is_current
  from public.embeddings e
  where e.workspace_id = q_workspace
  group by e.embedding_model
  order by count(*) desc;
$$;
