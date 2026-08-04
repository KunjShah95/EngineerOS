-- EngineerOS — cron resume cursor
-- Run after 20260802000013_scale_indexes.sql.
--
-- The daily automation drain (/api/cron/drain) must eventually reach every
-- workspace, but it runs on a time budget. Persisting a resume cursor here
-- lets later runs continue where the previous one left off instead of always
-- re-scanning from the top (which, past a handful of workspaces, starves the
-- tail of the list). Accessed only by the service-role cron client, so no RLS
-- policies are required.

create table if not exists public.cron_state (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
