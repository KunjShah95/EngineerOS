# Calendar (Weekly Grid) — Design

**Date:** 2026-08-02
**Branch:** `feat/calendar`
**Source:** MVP.md (Should-Have: "Calendar"), UI_DEVELOPMENT_PLAN.md step ordering, INFORMATION_ARCHITECTURE.md route table, DESIGN_SYSTEM.md tokens

## Goal

A read-only weekly Calendar that shows, per day, the tasks due that day (colored by priority) and an indicator/link when that date has a daily note. Users navigate prev/next week and Today, click a day to open its daily note, and click a task to open its detail. Dated tasks come from `tasks.due_date`; daily notes come from the existing `daily_notes` table. No schema change, no new dependencies.

## Context

The app shell, auth, task/notes/project/daily features, and Supabase layer are shipped (`master`). Calendar is the first "close the MVP" Should-Have. Tasks already have `due_date` (nullable); daily notes already auto-create one per workspace/date. Navigation lives in `AppNav.tsx`; routes live under `src/app/(app)/`.

## Design

### Approach
A read-only weekly grid. Tasks are fetched once for the workspace, grouped client-side by `due_date`, and only those in the visible week render in their day cell; tasks with no `due_date` render in an "Unscheduled" strip so nothing is hidden. A small daily-notes lookup marks which of the 7 days have an entry.

Rejected: month-grid/drill-down (more code, not needed by the weekly-grid goal); inline quick-add (mutation surface not worth it for a read view — YAGNI).

### Files
- Create: `src/app/(app)/calendar/page.tsx` — thin page rendering `CalendarPage`.
- Create: `src/components/calendar/CalendarPage.tsx` — owns week-start state (default today, aligned to Monday), Prev/Today/Next, renders header + `WeekGrid` + `UnscheduledStrip`.
- Create: `src/components/calendar/UnscheduledStrip.tsx` — the roll-up of tasks with no due date (top-N CTA to /tasks).
- Create: `src/components/calendar/WeekGrid.tsx` — 7-column Mon–Sun layout for a `Date[]` week.
- Create: `src/components/calendar/DayCell.tsx` — day header, today highlight, due task pills, "Open" daily-note link.
- Create: `src/components/calendar/TaskPill.tsx` — compact task label colored by priority (reuse `src/lib/task-meta.ts` if it exposes priorities).
- Modify: `src/components/shell/AppNav.tsx` — add "Calendar" entry in the primary nav (after Tasks, before Notes). New permanent path `/calendar`.

### Data flow
```
Page (server)          → <CalendarPage/> (client)
CalendarPage           → useTasks(workspaceId)  → all non-deleted tasks
                         useDailyNotesForWeek(workspaceId, week) → dates present
                         filter task.due_date ∈ [weekStart, weekStart+6]
WeekGrid/DayCell       → render due pills + daily-note "Open" link
Unscheduled strip      → tasks where due_date == null (top-N CTA to /tasks)
```

### Routing & interaction
- Nav "Calendar" → `/calendar` (lifetime of route group `(app)`, protected by the existing proxy).
- Day header / "Open" → `Router.push(/daily/YYYY-MM-DD)`.
- `TaskPill` → `Router.push('/tasks?task=<id>')` (reuses existing TaskDetailPanel).
- Prev/next move `weekStart` by ±7 days; Today resets to current week.

### Design details
- Week start: as-is first day **Monday**; week label "Aug 2026 · Week N" or "Aug 2 – Aug 8, 2026".
- Today’s cell emphasized (accent ring / filled header).
- Day pill text truncated (line-clamp-1), tone by priority via the task meta color map; done tasks struck out.

### Error handling & empty states
- `useTasks`/daily query: standard `isLoading` → centered `PageLoader`; error → `EmptyState` ("Couldn’t load your calendar").
- No tasks at all → `EmptyState` ("Nothing scheduled — add a task with a due date").
- Week with zero events: day cells still render, empty, with the Open link for daily notes.
- Supabase unconfigured → the existing `AppShell` `SetupNotice` shows (unchanged).

### Verification
- `npm run build` and `npm run lint` pass.
- Dev-mode browser (needs a configured `.env.local` + migration to render the shell): current week shows dated tasks grouped by day, today highlighted, task clicks open `/tasks?task=<id>`, day link opens `/daily/<date>`, prev/next/Today work, Unscheduled strip lists undated tasks. 
- Without credentials the calendar is hidden behind `SetupNotice` (same as all `(app)` routes) — build/lint become the dev-mode bar of acceptance.

### Non-Goals
- Month view, drag-and-drop rescheduling, inline task creation in a cell, calendar sync, recurring tasks filters, time-of-day scheduling. (Later, separate.)

## Acceptance
- [ ] `npm run build` + `npm run lint` green on `feat/calendar`.
- [ ] Nav "Calendar" present and routes to `/calendar`; no duplicate/proxy issues.
- [ ] Weekly grid renders Mon–Sun with correct dates for current week; Today highlighted.
- [ ] Tasks with due dates inside the week appear in the correct (nearest) day cell; undated tasks appear in the Unscheduled strip.
- [ ] Day cells with a daily note show an "Open" affordance.
- [ ] Clicking a task routes to `/tasks?task=<id>`; clicking a day/Open routes to `/daily/<date>`.
- [ ] Prev/Next/Today navigate weeks correctly.