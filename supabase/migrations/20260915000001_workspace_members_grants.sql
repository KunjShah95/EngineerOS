-- Repair: client grants for tenancy tables + schema-cache reload.
--
-- The tenancy migration (20260914000001) created workspace_members /
-- workspace_invites with RLS policies but no GRANTs to the PostgREST roles.
-- Without a table-level GRANT, an authenticated client gets
-- "permission denied" (42501) instead of RLS-filtered rows, and the
-- `select=*,workspace_members(...)` embed in useWorkspace.ts fails.
-- Other tables in this project rely on Supabase default privileges, which
-- are not guaranteed for tables created via `db push` as postgres — so
-- grant explicitly here. Idempotent: safe to re-run.
--
-- Also sends `NOTIFY pgrst, 'reload schema'` so PostgREST picks up the new
-- FK relationship immediately. Without this, the embed keeps returning
-- PGRST200 / HTTP 400 ("Could not find a relationship ... in the schema
-- cache") until the cache reloads on its own.

grant select, insert, update, delete on public.workspace_members to authenticated;
grant select, insert, delete on public.workspace_invites to authenticated;

-- PostgREST picks up new tables/FKs on reload; Supabase hosted listens on this channel.
notify pgrst, 'reload schema';
