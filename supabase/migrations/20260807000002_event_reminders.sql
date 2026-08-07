-- Calendar event reminders — Phase 4 of calendar-events.
-- Run after 20260807000001_calendar_events.sql.
--
-- Links the materialized reminders feed to calendar events. Event reminder
-- jobs reuse the existing 'reminder' job kind with a payload.event_id (no
-- enum change); the drain materializes them into public.reminders, so in-app
-- + email notifications behave exactly like task reminders. Deleting an event
-- cascades its reminder rows via the FK below.
alter table public.reminders
  add column if not exists event_id uuid references public.events (id) on delete cascade;

create index if not exists reminders_event_idx on public.reminders (event_id);
