# Semantic Search (Phase 8a) Design Spec

**Date:** 2026-08-02
**Status:** Approved
**Branch:** `master`

## Goal

Deliver the first slice of the Phase 8 AI Layer: **semantic search across the workspace**. Given a natural-language query, return the most relevant notes, tasks, resources, daily notes, and PDFs — not just substring matches. This is the prerequisite for Phase 8b (workspace Q&A / RAG assistant + AI memory).

## Non-Goals / Scope Boundary

- No workspace Q&A assistant, no RAG answer generation, no persisted AI conversations (Phase 8b).
- No unify/refactor of the existing AI summary / PDF chat / transcription surfaces (Phase 8b).
- No chat history or memory tables (Phase 8b).
- Not wiring a live Supabase instance (still out of scope — the app keeps working unconfigured). The schema + RPC + retrieval path ship correct-and-ready; today the feature runs on the local fallback so it is testable immediately.
- No rework of the non-semantic (substring) search behavior.

## Architecture

**Call once, retrieve many.** The index stores a fixed embedding per (entity_type, entity_id, chunk). At query time we embed the query text and retrieve nearest chunks by cosine similarity via pgvector. Because assets are indexed per chunk, PDF pages and long notes retrieve at paragraph granularity.

Layering (mirrors the existing `src/lib/ai.ts` OpenAI+local pattern):

```
src/lib/ai/embeddings.ts                   # embedText(text) + embedQuery()
src/lib/ai/index.ts (extend)               # indexEntity(), indexWorkspace(), reindexChunk(), deleteEntityEmbeddings()
src/hooks/useSemanticSearch.ts             # useSemanticSearch(workspaceId, query, kind?) server route hook
src/app/api/search/semantic/route.ts       # POST {workspaceId, query, kind?} -> ranked {chunks, fallback:boolean}
src/components/search/SemanticSearchGroup.tsx   # renders Semantic results in CommandPalette (client)
src/components/search/CommandPalette.tsx   # (modified) add "Semantic" toggle + Semantic results group
supabase/migrations/20260802000003_semantic_search.sql   # pgvector + embeddings table + RPC
```

### Fallback chain

1. **No API key** → `embedText` returns a deterministic local fingerprint vector; retrieval ranks against the precomputed index if present, else a keyword-weighted pass over the client cache. UI shows a small "local mode" badge.
2. **API key present** (OpenAI `text-embedding-3-small`, dim 1536) → real embeddings, stored in the `embeddings` table, retrieved via `semantic_search()` RPC.
3. **Query failure** → the route returns `{error}`; the palette surfaces it as a toast, never a crash.

## Data Model

### `embeddings` table

| Column | Type | Notes |
|---|---|---|
| id | uuid PK default gen_random_uuid() | |
| workspace_id | uuid FK → workspaces.id | |
| entity_type | `embedding_entity` enum (note, task, resource, daily_note, pdf) | |
| entity_id | uuid | row it came from |
| kind | text nullable | for resources: the kind (code/bookmark/…); for tasks: status |
| chunk_index | int not null default 0 | ordering within an entity |
| content | text not null | the text that was embedded |
| embedding | vector(1536) not null | |
| created_at | timestamptz default now() | |

Indexes: composite `(workspace_id, entity_type, entity_id)` + `chunk_index` (unique), and an HNSW ivfflat vector index on `embedding` filtered by `workspace_id`.

### `semantic_search(workspace_id, query, result_limit)` RPC

```sql
create or replace function public.semantic_search(q_workspace uuid, q_embedding vector(1536), q_limit int default 12)
returns table (
  entity_type public.embedding_entity, entity_id uuid, chunk_index int,
  content text, score float
)
language sql
security invoker
as $fn$
  select e.entity_type, e.entity_id, e.chunk_index, e.content,
         2 - (e.embedding <=> q_embedding) as score
  from public.embeddings e
  where e.workspace_id = q_workspace
  order by e.embedding <=> q_embedding
  limit q_limit;
$fn$;
```

RLS: `embeddings` enabled, four policies via `public.is_workspace_member(workspace_id)`; the RPC is `security invoker` so it inherits the caller's RLS.

### `embedding_entity` enum + types

```ts
export type EmbeddingEntity = "note" | "task" | "resource" | "daily_note" | "pdf";
```

Append to `src/types/database.ts` the `EmbeddingEntity` type, plus a row-interf for the hook result.

## Indexing strategy

- **Full index (one-time):** pull from BM25-fallback metadata the union of entity ids we already act on, chunk texts, and embed each; upsert into `embeddings`. Implemented as a single admin route `/api/search/index` (POST) so it can run without a live UI and can be triggered.
- **Incremental:** on writes (the client already mutate on autosave), a `reindexChunk` invalidates the affected `embeddings` rows for that (entity_type, entity_id). For V1 this is a coarse "drop + re-embed" per entity on save (cheap, optimistic) — a background worker is deferred (Phase 10 Automation).
- PDFs: embed the `pdf_documents.text_content` chunked via `chunkText()` (reuses `src/lib/ai.ts`).

## Hooks (`src/hooks/useSemantic.ts`)

Mirror `useSearch.ts`:

- `useSemanticSearch(workspaceId, query, kind?)` — `["semantic", ws, query, kind]`, enabled when query length ≥ 2 and workspace set.
- Route returns `{ ok, mode, chunks }` with `mode: "local-keyword" | "embeddings"`.

## UI

### Command palette (⌘K) — `CommandPalette.tsx` (modified)

- Add a small "Semantic" toggle/segmented control near the input.
- When on (and query has ≥2 chars), show a `Semantic` group above the substring matches with up to 6 results; each item is `icon (FileText/Task Square/…) · title` + a faint distance/relevance label, clicking navigates to the note/task/resource/PDF.
- When no key is present, show subtle "local match" text on the group header (same pattern the AI summary uses).
- Keep the existing substring groups exactly as-is when the toggle is off.

`SemanticSearchGroup` renders the results group; it's a small presentational component (kind-aware icon via existing `getResourceKindMeta` where relevant).

## Error / Loading / Empty

- Loading: existing `Loader2` spinner while `isFetching`.
- Error: toast; group hidden when server errors.
- No results: a short "No semantic matches" line, distinct from the substring "No results".

## Testing / Verification

- Unit none (project convention) — `npx tsc --noEmit` per task.
- End-to-end: `npm run build` (route table now includes `/api/search/semantic`) + `npm run lint`.
- Runtime (no key — local fallback): open ⌘K, toggle Semantic, type a semi-phrase of a stored note/resource; confirm it surfaces above substring results and navigates on click.

## Open Questions (resolved)

- **Where** — a mode inside the existing command palette (⌘K) — **resolved**.
- **Index scope** — notes, tasks, resources (all 5 kinds), daily notes, PDFs — **resolved**.
- **Provider** — BYOK OpenAI (embeddings only) with local deterministic fallback; pgvector for storage/retrieval — **resolved**.