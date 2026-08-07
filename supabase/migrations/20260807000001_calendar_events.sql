-- Calendar events — timed events shown alongside tasks on the calendar.
-- Recurrence (rrule_*) and reminder (remind_minutes) columns are created now
-- but stay dormant until Phases 3 and 4; keeping them here avoids a later
-- destructive migration.
CREATE TABLE IF NOT EXISTS events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title          text NOT NULL DEFAULT 'New event',
  description    text NOT NULL DEFAULT '',
  location       text,
  color          text NOT NULL DEFAULT 'blue',
  all_day        boolean NOT NULL DEFAULT false,
  starts_at      timestamptz NOT NULL,
  ends_at        timestamptz NOT NULL,

  rrule_freq     text,
  rrule_interval int,
  rrule_byday    jsonb,
  rrule_until    date,

  remind_minutes int,

  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz
);
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY events_owner ON events
  USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()));
CREATE INDEX IF NOT EXISTS events_workspace_range
  ON events(workspace_id, starts_at);
