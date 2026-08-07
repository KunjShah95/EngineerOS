# Calendar Events — Phase 3 (Recurrence) & Phase 4 (Reminders)

**Date:** 2026-08-07
**Status:** Implemented (post-hoc plan — code shipped first, then documented)
**Spec:** `docs/superpowers/specs/2026-08-07-calendar-events-design.md`
**Branch:** `feat/calendar-events-phase-1`

## Goal

Ship the last two phases of the Google-Calendar-style events feature on top of
Phase 1 (events core) and Phase 2 (day/hour grids):

- **Phase 3 — Recurrence**: RRULE-lite "expand-on-read" engine. Users set a
  repeat rule (daily / weekly / monthly, interval, weekly bydays, optional end
  date) in the event editor; the calendar expands the series into concrete
  instances for the visible range. Edits apply to the **whole series** (the v1
  scope agreed in the spec).
- **Phase 4 — Reminders**: users pick a lead time (10 min / 30 min / 1 h / 1 d
  before start) in the editor; the client enqueues a `reminder` job on the
  existing durable jobs queue; the existing automation drain materializes it
  into the in-app reminders feed (and mirrors to email when configured).

## Architecture

### Phase 3 — Recurrence

- `src/lib/recurrence.ts` — `expandEvent(event, fromISO, toISO)`:
  - Non-recurring events return one instance iff it intersects the range.
  - Daily / weekly (with `byday` weekday filtering, Monday-aligned week math)
    / monthly (clamped to month length) with `interval` and inclusive
    `rrule_until`.
  - Each instance preserves the series' time of day + duration, gets an
    occurrence-specific `starts_at`/`ends_at`, an `instanceDate` (local
    YYYY-MM-DD), and the series' original `seriesStartsAt`/`seriesEndsAt`.
    The series base is what the editor prefills — editing an occurrence edits
    the series without silently moving its base.
  - Hard-capped at `MAX_INSTANCES = 366`.
- `src/hooks/useEvents.ts` — the range query fetches any row whose range
  overlaps the window **or** any recurring series (`rrule_freq.not.is.null`),
  then expands client-side and re-sorts instances by occurrence time (pills
  render chronologically within a day).
- `src/components/calendar/EventEditorModal.tsx` — "Repeats" select
  (never/daily/weekly/monthly), interval input, weekly weekday toggles
  (validated: weekly requires ≥ 1 day), optional "Ends" date.

### Phase 4 — Reminders

- `supabase/migrations/20260807000002_event_reminders.sql` — adds
  `reminders.event_id uuid references events(id) on delete cascade` + index.
  Deleting an event cascades its materialized reminders. No jobs-kind enum
  change: event reminders reuse the existing `reminder` kind.
- `src/hooks/useEvents.ts` — `syncEventReminder` runs after event
  create/update/delete:
  - Deletes any **pending** reminder job for the event (jsonb filter
    `payload->>event_id`), then re-enqueues one at
    `starts_at - remind_minutes` when set. If the delete fails, it bails
    without inserting (a stale job firing once beats duplicate reminders).
  - Past fire times are skipped (you can't be reminded about an event that
    already started).
  - Update resyncs when the reminder, start time (incl. drag-moves), or title
    changed; the modal always sends start/end so every save resyncs
    idempotently.
- `src/lib/automation.ts` — `runReminderJob` gained an event branch: verify the
  event still exists (soft-delete aware), materialize the reminder row with
  `event_id`, mirror to email with a `/calendar?event=` link. Idempotency guard
  (per `job_id`) moved to the top, shared by both branches.
- `src/components/calendar/EventEditorModal.tsx` — "Reminder" select
  (None/10m/30m/1h/1d). A reminder on an already-started event is silently
  cleared with an info toast (a dead reminder setting is worse than none).
- `src/components/shell/NotificationPanel.tsx` — event reminders deep-link to
  `/calendar?event=<id>`.
- `src/components/calendar/CalendarPage.tsx` — the editor is driven by the URL
  (`?event=`), derived rather than synced in an effect (respects the repo's
  `react-hooks/set-state-in-effect` lint). Closing the modal clears the param.

## Files

| File | Change |
| --- | --- |
| `src/lib/recurrence.ts` | new — RRULE-lite expansion engine |
| `src/lib/recurrence.test.ts` | new — 12 vitest cases (daily/weekly/monthly, interval, until, byday, series identity) |
| `src/hooks/useEvents.ts` | recurrence expansion + sort; reminder job sync on create/update/delete |
| `src/types/database.ts` | `CalendarEvent` rrule/reminder fields; `ReminderRow.event_id` |
| `src/components/calendar/EventEditorModal.tsx` | Repeats UI (P3), Reminder UI (P4), series-base prefill, reminder-past guard |
| `src/lib/automation.ts` | `runReminderJob` event branch |
| `src/lib/automation.test.ts` | +3 event-reminder cases (materialize / deleted / soft-deleted) |
| `src/components/shell/NotificationPanel.tsx` | event reminder → `/calendar?event=` |
| `src/components/calendar/CalendarPage.tsx` | URL-driven editor deep link |
| `supabase/migrations/20260807000002_event_reminders.sql` | new — `reminders.event_id` |

## Validation

```bash
npx vitest run            # 127/127 pass (9 files)
npm run typecheck         # clean
npx eslint src/components/calendar src/lib/recurrence.ts src/lib/recurrence.test.ts src/hooks/useEvents.ts src/lib/automation.ts src/lib/automation.test.ts src/components/shell/NotificationPanel.tsx
npm run build             # compiles
```

## Known limitations (documented v1 scope)

- **Recurring event reminders fire once** at the series' first occurrence minus
  the lead time — later occurrences don't re-remind.
- **Editing an occurrence edits the whole series**; the editor prefills the
  series base (like Google Calendar's "edit series"), so saving doesn't move
  the base. There's no per-instance override ("this event only") yet.
- **Deep links** (`?event=`) open the first matching instance in the visible
  range; reminders point at the series start, so this is correct for them.
- **Reminders already fired for a soft-deleted event** stay in the feed and
  their deep link dead-ends (the event is filtered from queries). Future jobs
  for deleted events are dropped by the drain.
- Timezone-boundary drift on range queries is a known Phase 1 accepted
  limitation (events near window edges can straddle a fetch boundary; display
  bucketing by local date remains correct).

## Manual UAT

1. Create an event → set **Repeats: Weekly** with Mon/Wed → save → switch to
   month view: instances appear on the chosen weekdays, correct times.
2. Click a later occurrence → editor prefills the **series** start/end, not
   that occurrence. Edit the title → save → all occurrences update.
3. Set **Repeats: Never** on a series → it becomes a one-off.
4. Set a monthly event on the 31st → February clamps to the 28th.
5. Create an event with a **30-minute reminder** → run the automation drain
   (or wait for the client interval) after the fire time → the reminder appears
   in the bell panel → clicking it opens the event editor.
6. Drag an event with a pending reminder to a later slot → the reminder
   re-times with it (drain materializes at the new time).
7. Delete an event with a pending reminder → no reminder ever fires.
8. Set a reminder on an event that already started → info toast, no dead
   setting.
