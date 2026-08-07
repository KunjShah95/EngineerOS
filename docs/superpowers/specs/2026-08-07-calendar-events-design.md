# Calendar Events — Design Spec

**Date:** 2026-08-07
**Status:** Approved for Phase 1 implementation
**Author:** brainstorming session

## Goal

Make the EngineerOS calendar work like Google Calendar by adding a real
**timed Events** concept, on top of the existing task-by-due-date view. Events
have times, colors, recurrence, and reminders. Tasks continue to render
alongside events unchanged.

## Background — current state

The calendar today is **task-driven only**:

- `CalendarPage.tsx` reads tasks via `useTasks`, buckets them by `due_date`
  (a date-only string, no time-of-day), and renders pills on week/month grids.
- Grids: `WeekGrid` (7 day columns) and `MonthGrid` (6×7). No hourly time grid.
- No create-in-place: tasks are created elsewhere; the calendar only opens a
  `TaskDetailPanel` for an existing task.
- `GET /api/calendar/export` emits due tasks as `.ics` (read-only export).

There is no Events table, no timed rendering, no recurrence, no calendar-side
create/edit.

## Scope

Full feature set is specified across four phases. **Phase 1 is the first
implementation plan**; later phases get their own plans.

- **Phase 1 — Events core.** `events` table, types, CRUD hooks, event editor
  modal, and rendering timed events as pills on the existing week/month grids.
- **Phase 2 — Day/time grid.** New Day view + hourly Week view; events
  positioned by time; click-empty-slot / drag-to-create; drag move/resize
  (resize may defer).
- **Phase 3 — Recurrence.** Rule fields on events, expand-on-read, "repeats" UI.
- **Phase 4 — Reminders.** `remind_minutes` on event enqueues a `reminder` job
  drained by the existing automation queue → in-app/email notification.

Non-goals (v1): shared/multiple external calendars, invitees/RSVP, timezone
conversion beyond the workspace's local time, `.ics` import of events,
per-instance recurrence overrides.

---

## Architecture

### Data model — `events` table (Phase 1, with rule/reminder columns present)

Follows the established table pattern (`workspace_id` FK, RLS on
`owner_id = auth.uid()`, `deleted_at` soft-delete). Recurrence and reminder
columns are added in Phase 1 so later phases need no destructive migration; they
are simply unused until Phases 3–4.

```sql
CREATE TABLE IF NOT EXISTS events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title         text NOT NULL DEFAULT 'New event',
  description   text NOT NULL DEFAULT '',
  location      text,
  color         text NOT NULL DEFAULT 'blue',   -- named token, mapped in UI
  all_day       boolean NOT NULL DEFAULT false,
  starts_at     timestamptz NOT NULL,           -- for all_day, midnight local
  ends_at       timestamptz NOT NULL,           -- >= starts_at

  -- Phase 3 (nullable = non-recurring):
  rrule_freq    text,        -- 'daily' | 'weekly' | 'monthly' | null
  rrule_interval int,        -- default 1 when freq set
  rrule_byday   jsonb,       -- ['MO','WE','FR'] for weekly; null otherwise
  rrule_until   date,        -- inclusive end of series; null = open-ended cap

  -- Phase 4 (null = no reminder):
  remind_minutes int,        -- minutes before starts_at

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY events_owner ON events
  USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()));
CREATE INDEX IF NOT EXISTS events_workspace_range
  ON events(workspace_id, starts_at);
```

Migration file: `supabase/migrations/20260807000001_calendar_events.sql`.

### Types (`src/types/database.ts`)

```ts
export type EventColor = 'blue' | 'green' | 'red' | 'amber' | 'purple' | 'gray';

export interface CalendarEvent {
  id: string;
  workspace_id: string;
  title: string;
  description: string;
  location: string | null;
  color: EventColor;
  all_day: boolean;
  starts_at: string;   // ISO timestamptz
  ends_at: string;
  rrule_freq: 'daily' | 'weekly' | 'monthly' | null;
  rrule_interval: number | null;
  rrule_byday: string[] | null;
  rrule_until: string | null;
  remind_minutes: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
```

Named `CalendarEvent` (not `Event`) to avoid clashing with the DOM `Event` type.

### Hooks (`src/hooks/useEvents.ts`)

Mirrors `useSnippets.ts`:

- `useEvents(workspaceId, fromISO, toISO)` — query events whose
  `[starts_at, ends_at]` overlaps the visible range. Query key
  `["events", workspaceId, fromISO, toISO]`. In Phase 1 the query fetches rows
  directly; in Phase 3 the same hook additionally expands recurring rows into
  concrete instances client-side for the range (see Recurrence).
- `useCreateEvent(workspaceId)` — insert with defaults; returns the row.
- `useUpdateEvent(workspaceId)` — patch by id, bump `updated_at`.
- `useDeleteEvent(workspaceId)` — soft-delete (`deleted_at = now()`).

All mutations `invalidateQueries({ queryKey: ["events", workspaceId] })`
(prefix match invalidates every range).

### Recurrence — expand on read (Phase 3)

Chosen approach: **RRULE-lite, expand on read.** One row stores the rule; a pure
function `expandEvent(event, rangeFrom, rangeTo)` in `src/lib/recurrence.ts`
returns concrete `{ ...event, starts_at, ends_at, instanceDate }` occurrences
that fall in the visible range. Non-recurring events return `[event]`.

- Supported: `daily`/`weekly`/`monthly`, `interval`, weekly `byday`, `until`.
- Safety cap: never expand past `rrule_until`, and hard-cap open-ended series to
  the visible range only (grids always query a bounded range, so this is natural).
- Edit/delete in v1 acts on the **whole series** (the single row). Per-instance
  overrides are an explicit non-goal; an `event_exceptions` table is the future
  extension point if needed.

### Reminders — ride the automation queue (Phase 4)

The app already has a `jobs` queue with kind `reminder`/`digest`, drained by an
existing route. On event create/update with `remind_minutes` set, enqueue a
`reminder` job at `starts_at - remind_minutes`. The drain fires the existing
in-app notification (and email when `RESEND_API_KEY` is set). No new cron.
For recurring events, enqueue a rolling window (e.g. next N occurrences) refreshed
by the same drain — detailed in the Phase 4 plan.

### UI components

**Phase 1:**

- `EventEditorModal.tsx` — create/edit form: title, all-day toggle, start/end
  date+time, color picker, location, description. Delete button when editing.
  Rule + reminder fields rendered but disabled/hidden until their phase.
- `EventPill.tsx` — colored pill for an event on a day cell; click opens editor.
- `CalendarPage.tsx` — add `useEvents(range)`, merge events into day buckets
  alongside tasks, add a "New event" button that opens the editor. Day cell and
  pill click handlers route to task panel (tasks) or event modal (events).

**Phase 2:** `DayGrid.tsx` / `HourWeekGrid.tsx` with hourly rows, absolute-
positioned event blocks, click/drag-to-create.

## Data flow (Phase 1)

1. `CalendarPage` computes `[from, to]` from the current view (already does).
2. `useEvents(workspaceId, from, to)` fetches overlapping events.
3. Events + tasks are bucketed by local date into the same day-cell map;
   each cell renders task pills (existing) and event pills (new).
4. "New event" or clicking a day → `EventEditorModal` (create, date prefilled).
5. Clicking an event pill → `EventEditorModal` (edit).
6. Save → `useCreateEvent`/`useUpdateEvent` → query invalidation → grid refresh.

## Error handling

- Hooks throw on Supabase error (existing pattern); React Query surfaces it.
  `CalendarPage` keeps its existing `isError` EmptyState for the tasks/events load.
- Editor validates `ends_at >= starts_at` before submit; shows inline error.
- Save/delete failures show a toast (existing toast util used by TaskDetailPanel).

## Testing

- `src/lib/recurrence.ts` — unit tests for `expandEvent` (Phase 3): interval,
  byday, until boundary, open-ended cap, non-recurring passthrough.
- Date bucketing — unit test that an event spanning midnight lands on the correct
  local day(s).
- Hook smoke: create → appears in range query → update → soft-delete disappears.
- Manual UAT per phase: create/edit/delete an event on the grid; confirm it
  renders on the right day with the right color and time label.

## Open decisions deferred to later phases

- Drag-to-resize in Phase 2 (may ship move-only first).
- Reminder windowing strategy for recurring events (Phase 4 plan).
- Whether to add `.ics` import of events (currently a non-goal).
