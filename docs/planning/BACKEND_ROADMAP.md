# BACKEND_ROADMAP.md — EngineerOS

## Stack Choice

**Supabase** (Postgres + Auth + Row-Level Security + realtime + storage), consumed directly from the Next.js frontend via the Supabase JS client — no separate custom API server in V1.

Rationale: DATABASE_PLAN.md schema is relational with clear FKs and RLS-friendly `workspace_id` scoping on every table. Supabase gives auth, DB, and RLS in one system with no infra to run, which matches the "no team collaboration / no enterprise" scope of the MVP — a custom backend would be premature engineering (YAGNI) until Phase 8+ needs bespoke AI-serving infrastructure.

## Authentication

- Supabase Auth, email+password provider only for V1 (OAuth providers are a Could Have, not required)
- On successful signup: a `users` profile row and a default `workspaces` row are created via a Postgres trigger (`handle_new_user()`), not a client-side round trip — guarantees a workspace exists before the frontend's first dashboard query.

```sql
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1));

  insert into public.workspaces (owner_id, name)
  values (new.id, 'My Workspace');

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

## Row-Level Security

Every table scoped by `workspace_id`. Standard policy pattern, applied per table:

```sql
alter table public.notes enable row level security;

create policy "workspace members can read their notes"
  on public.notes for select
  using (workspace_id in (
    select id from public.workspaces where owner_id = auth.uid()
  ));

create policy "workspace members can write their notes"
  on public.notes for insert with check (
    workspace_id in (select id from public.workspaces where owner_id = auth.uid())
  );

create policy "workspace members can update their notes"
  on public.notes for update using (
    workspace_id in (select id from public.workspaces where owner_id = auth.uid())
  );
```

Repeated identically for `projects`, `tasks`, `daily_notes`, `tags`, `quick_captures`, and the join tables (joins check via their parent's `workspace_id` through a subquery join). No table ships without RLS enabled — this is a blocking checklist item before Phase 6 frontend integration, not a follow-up.

## API Surface

No custom REST/GraphQL layer. Frontend calls Supabase directly:

- **Reads/writes:** Supabase JS client (`.from('tasks').select()...`), typed via `supabase gen types typescript` run against the schema — types committed to `types/database.ts` and regenerated whenever DATABASE_PLAN.md schema changes.
- **Full-text search:** Postgres `tsvector` column (per DATABASE_PLAN.md) queried via `.textSearch()` — no external search service (Algolia/Elastic) for V1 volume (30 notes / 100 tasks per success metric in MVP.md doesn't justify one).
- **Realtime:** Supabase Realtime subscriptions on `tasks` table only, for kanban board — so if a user has two tabs open, drag state stays in sync. Not enabled on notes/projects in V1 (no concurrent-editing requirement yet — Won't Have is team collaboration).

## Daily Note Auto-Creation

Handled server-side via upsert, not a cron job:

```typescript
async function getOrCreateDailyNote(workspaceId: string, date: string) {
  const { data } = await supabase
    .from('daily_notes')
    .upsert(
      { workspace_id: workspaceId, date },
      { onConflict: 'workspace_id,date', ignoreDuplicates: true }
    )
    .select()
    .single();
  return data;
}
```

Called on `/daily/:date` load. Relies on the `(workspace_id, date)` unique constraint from DATABASE_PLAN.md to make this idempotent.

## Storage

Supabase Storage bucket `avatars` for profile pictures (Settings screen). No other file storage in V1 — attachments/PDFs are explicitly Could Have (PDF Chat), not built now.

## Environment & Deployment

- Supabase project: one per environment (dev/prod), schema migrations tracked via Supabase CLI (`supabase/migrations/*.sql`) — DATABASE_PLAN.md is the source of truth that migrations implement, not the other way around.
- Frontend deployed on Vercel, environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) set per environment, no service-role key ever shipped to the client.
- CI: run `supabase db lint` + typegen check on every PR that touches `supabase/migrations/`, so `types/database.ts` can't silently drift from the real schema.

## Explicitly Deferred (not built in Phase 7)

- Custom API server / edge functions beyond the one auth trigger above
- Background job queue (needed starting Phase 10 — Automation)
- Vector/embeddings storage (Phase 8 — AI Layer, per DATABASE_PLAN.md extensibility notes)
- Multi-tenant billing hooks (Won't Have per MVP.md)
