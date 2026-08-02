-- EngineerOS — Phase 11: Launch (email notifications + weekly digest)
-- Run after 20260802000009_automation.sql.
--
-- Adds the outbound-notification surface for the reminders feed:
--   - workspaces.email            — where reminder + digest emails go (null = none)
--   - workspaces.weekly_digest    — user toggle; the drain keeps a digest job alive
--   - automation_job_kind 'digest' — a self-perpetuating job the drain processes
--                                    (sends the weekly summary + re-enqueues +7d)
-- Emails are sent via Resend from the drain route when RESEND_API_KEY is set;
-- without a key the in-app reminders feed still works exactly as before.

alter table public.workspaces
  add column email text,
  add column weekly_digest boolean not null default false;

alter type public.automation_job_kind add value 'digest';

-- The drain looks up pending jobs by (workspace, kind, status, run_at) for
-- reminders and digests; migration 09's index omits `kind`, so add one that
-- serves both step-4/step-5 queries as the queue grows.
create index jobs_workspace_kind_status_run_at_idx
  on public.jobs (workspace_id, kind, status, run_at);
