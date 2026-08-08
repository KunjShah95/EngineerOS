-- Task times — timed tasks render as resizable blocks on the calendar hour grid.
-- due_time is an optional local "HH:MM" start on the due date; tasks without it
-- stay date-only (the all-day strip). duration_minutes is the scheduled block
-- length (default 60) that drag-to-resize adjusts.
alter table public.tasks
  add column if not exists due_time text,
  add column if not exists duration_minutes int default 60;
