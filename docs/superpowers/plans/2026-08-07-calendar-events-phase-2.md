# Calendar Events — Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add a Google-Calendar-style **day/time grid** to EngineerOS: an hourly **Day view** and an **hourly Week view** where timed events are positioned on a time axis. Users can **click an empty slot** to create an event prefilled with that time, **drag across empty space** to create an event covering the dragged range, and **drag events** to move them to a new time/day. Tasks and all-day events stay visible in an all-day strip above the timed area.

**Architecture:** Reuses the Phase 1 `events` table, `useEvents` / `useUpdateEvent` hooks, `EventEditorModal`, `EventPill`, `TaskPill`, and `EVENT_COLORS` untouched. All grid math (hour rows, clipping, overlap layout, snapping) is **pure** and lives in `src/lib/calendar-grid.ts` (unit-tested with vitest, matching repo conventions). Rendering uses **`@dnd-kit/core`** (already installed for the Kanban board) for drag-to-move, and native pointer events for click/drag-to-create (marquee selection needs raw pointer tracking that dnd-kit's activation constraint would delay). The old pill-style `WeekGrid` and `DayCell` are **deleted** — the hourly week grid replaces them. `TaskPill`/`EventPill` survive and are reused in the all-day strips.

**Tech Stack:** Next.js (App Router), React Query, Supabase JS client, `@dnd-kit/core` + `@dnd-kit/utilities` (already installed), `date-fns` (already used for `format`), shadcn/ui (`Dialog`, `Button`, `Input`), `sonner`, `lucide-react`, vitest.

---

## File Structure

**Create:**
- `src/lib/calendar-grid.ts` — pure helpers: `HOUR_HEIGHT`, `MINUTE_SNAP`, `minutesSinceMidnight`, `snapMinutes`, `minutesToLocalInput`, `localDateOf`, `clipEventToDay`, `layoutEventColumns`, `TimedLayout`.
- `src/lib/calendar-grid.test.ts` — vitest tests for the helpers.
- `src/components/calendar/EventBlock.tsx` — one timed event, absolutely positioned + draggable via dnd-kit.
- `src/components/calendar/HourGrid.tsx` — the hourly grid: hour labels, day columns, all-day strips, hour lines, "now" line, event blocks, click/drag-select create, drag-to-move (owns the `DndContext`). Exports `HourGridDay`.

**Modify:**
- `src/components/calendar/EventEditorModal.tsx` — replace the `initialDate` prop with `initialStart` / `initialEnd` (datetime-local strings) so slot/drag creation prefills exact times.
- `src/components/calendar/CalendarPage.tsx` — add a "day" view, render `HourGrid` for day/week views, wire `onCreateEvent`, remove the `WeekGrid`/`DayCell` usage.

**Delete:**
- `src/components/calendar/WeekGrid.tsx` — replaced by the hourly week grid.
- `src/components/calendar/DayCell.tsx` — only used by `WeekGrid`.

## Design decisions

- **Hour rows:** full 24h, `HOUR_HEIGHT = 56px` per hour (constant shared by math and CSS).
- **Snap:** `MINUTE_SNAP = 30` for create and move; a plain click on an empty slot creates a **1-hour** event starting at the snapped hour.
- **Overlap layout:** greedy interval coloring per day — overlapping events render side-by-side; `layoutEventColumns` is pure and tested.
- **Tasks:** tasks (date-only) render in each day column's all-day strip above the timed area; unscheduled tasks keep the existing `UnscheduledStrip` below the grid.
- **Drag-to-move:** dnd-kit `useDraggable` per `EventBlock` + a `useDroppable` day column per day. On drop, the new start time is computed from the pointer position inside the target column, snapped to 30 minutes; duration is preserved.
- **Drag-to-create:** native `pointerdown/move/up` with pointer capture on the timed area. A selection overlay renders the dragged range; releasing opens the editor prefilled. A sub-30-minute drag is treated as a click → 1-hour event.
- **"Now" line:** a `bg-destructive` line at the current time, only in the today column.
- **Resize is deferred** (explicit non-goal this phase); **month view stays a pill grid** (no drag/drop in month view).
- **Recurrence/reminders** remain dormant (Phases 3–4).

---

## Task 1: Grid math helpers + tests (TDD)

**Files:**
- Create: `src/lib/calendar-grid.ts`
- Test: `src/lib/calendar-grid.test.ts`

All geometry is pure so it can be unit-tested: hour geometry from `HOUR_HEIGHT`, clipping an event to a single local day, side-by-side overlap layout, minute snapping, and the datetime-local string used to prefill the editor.

- [x] **Step 1: Write the failing test**

Create `src/lib/calendar-grid.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import type { CalendarEvent } from "@/types/database";
import {
  DAY_MINUTES,
  HOUR_HEIGHT,
  MINUTE_SNAP,
  clipEventToDay,
  layoutEventColumns,
  localDateOf,
  minutesSinceMidnight,
  minutesToLocalInput,
  snapMinutes,
} from "./calendar-grid";

function evt(partial: Partial<CalendarEvent> & Pick<CalendarEvent, "starts_at" | "ends_at">): CalendarEvent {
  return {
    id: "e1",
    workspace_id: "w1",
    title: "Event",
    description: "",
    location: null,
    color: "blue",
    all_day: false,
    rrule_freq: null,
    rrule_interval: null,
    rrule_byday: null,
    rrule_until: null,
    remind_minutes: null,
    created_at: "",
    updated_at: "",
    deleted_at: null,
    ...partial,
  };
}

describe("minutesSinceMidnight", () => {
  it("returns local minutes since midnight", () => {
    expect(minutesSinceMidnight("2026-08-07T09:05:00")).toBe(545);
    expect(minutesSinceMidnight("2026-08-07T00:00:00")).toBe(0);
    expect(minutesSinceMidnight("2026-08-07T23:59:00")).toBe(1439);
  });
});

describe("snapMinutes", () => {
  it("rounds to the snap step", () => {
    expect(snapMinutes(545)).toBe(540); // 9:05 -> 9:00
    expect(snapMinutes(560)).toBe(570); // 9:20 -> 9:30
  });

  it("clamps to the day", () => {
    expect(snapMinutes(-10)).toBe(0);
    expect(snapMinutes(DAY_MINUTES)).toBe(DAY_MINUTES - MINUTE_SNAP);
  });
});

describe("minutesToLocalInput", () => {
  it("formats a datetime-local value", () => {
    expect(minutesToLocalInput("2026-08-07", 540)).toBe("2026-08-07T09:00");
    expect(minutesToLocalInput("2026-08-07", 1410)).toBe("2026-08-07T23:30");
  });
});

describe("localDateOf", () => {
  it("returns the local ISO date of a timestamptz", () => {
    expect(localDateOf("2026-08-07T09:00:00")).toBe("2026-08-07");
  });
});

describe("clipEventToDay", () => {
  it("clips a same-day event", () => {
    const e = evt({ starts_at: "2026-08-07T09:00:00", ends_at: "2026-08-07T10:00:00" });
    const layout = clipEventToDay(e, "2026-08-07");
    expect(layout?.topPx).toBe(9 * HOUR_HEIGHT);
    expect(layout?.heightPx).toBe(HOUR_HEIGHT);
    expect(layout?.clippedStart).toBe(false);
    expect(layout?.clippedEnd).toBe(false);
  });

  it("clips a midnight-spanning event onto both days", () => {
    const e = evt({ id: "m", starts_at: "2026-08-07T23:00:00", ends_at: "2026-08-08T01:00:00" });
    const first = clipEventToDay(e, "2026-08-07");
    const second = clipEventToDay(e, "2026-08-08");
    expect(first?.topPx).toBe(23 * HOUR_HEIGHT);
    expect(first?.heightPx).toBe(HOUR_HEIGHT);
    expect(first?.clippedEnd).toBe(true);
    expect(second?.topPx).toBe(0);
    expect(second?.heightPx).toBe(HOUR_HEIGHT);
    expect(second?.clippedStart).toBe(true);
  });

  it("returns null for a day the event does not cover", () => {
    const e = evt({ starts_at: "2026-08-07T09:00:00", ends_at: "2026-08-07T10:00:00" });
    expect(clipEventToDay(e, "2026-08-08")).toBeNull();
  });
});

describe("layoutEventColumns", () => {
  it("gives non-overlapping events the full column", () => {
    const a = evt({ id: "a", starts_at: "2026-08-07T09:00:00", ends_at: "2026-08-07T10:00:00" });
    const b = evt({ id: "b", starts_at: "2026-08-07T11:00:00", ends_at: "2026-08-07T12:00:00" });
    const map = layoutEventColumns("2026-08-07", [a, b]);
    expect(map.get("a")?.column).toBe(0);
    expect(map.get("a")?.columns).toBe(1);
    expect(map.get("b")?.column).toBe(0);
    expect(map.get("b")?.columns).toBe(1);
  });

  it("splits an overlapping pair side-by-side", () => {
    const a = evt({ id: "a", starts_at: "2026-08-07T09:00:00", ends_at: "2026-08-07T10:00:00" });
    const b = evt({ id: "b", starts_at: "2026-08-07T09:30:00", ends_at: "2026-08-07T10:30:00" });
    const map = layoutEventColumns("2026-08-07", [a, b]);
    expect(map.get("a")?.columns).toBe(2);
    expect(map.get("b")?.columns).toBe(2);
    expect(map.get("a")?.column).not.toBe(map.get("b")?.column);
  });

  it("reuses a column once the previous occupant ends (A B C chain)", () => {
    const a = evt({ id: "a", starts_at: "2026-08-07T09:00:00", ends_at: "2026-08-07T11:00:00" });
    const b = evt({ id: "b", starts_at: "2026-08-07T10:00:00", ends_at: "2026-08-07T12:00:00" });
    const c = evt({ id: "c", starts_at: "2026-08-07T11:00:00", ends_at: "2026-08-07T13:00:00" });
    const map = layoutEventColumns("2026-08-07", [a, b, c]);
    expect(map.get("a")?.column).toBe(0);
    expect(map.get("a")?.columns).toBe(2);
    expect(map.get("b")?.column).toBe(1);
    expect(map.get("b")?.columns).toBe(2);
    expect(map.get("c")?.column).toBe(0);
    expect(map.get("c")?.columns).toBe(2);
  });

  it("joins a cluster when the new event overlaps an earlier (not last) member", () => {
    const e = evt({ id: "e", starts_at: "2026-08-07T09:00:00", ends_at: "2026-08-07T12:00:00" });
    const p = evt({ id: "p", starts_at: "2026-08-07T10:00:00", ends_at: "2026-08-07T11:00:00" });
    const x = evt({ id: "x", starts_at: "2026-08-07T11:30:00", ends_at: "2026-08-07T13:00:00" });
    const map = layoutEventColumns("2026-08-07", [e, p, x]);
    expect(map.get("x")?.column).toBe(1); // shares a column with P, not E
    expect(map.get("x")?.columns).toBe(2);
  });

  it("ignores all-day events", () => {
    const allDay = evt({ id: "ad", all_day: true, starts_at: "2026-08-07T00:00:00", ends_at: "2026-08-07T00:00:00" });
    expect(layoutEventColumns("2026-08-07", [allDay]).size).toBe(0);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/calendar-grid.test.ts`
Expected: FAIL — cannot resolve `./calendar-grid`.

- [x] **Step 3: Write the implementation**

Create `src/lib/calendar-grid.ts`:

```ts
import { toISODate } from "@/lib/calendar";
import type { CalendarEvent } from "@/types/database";

/** Pixels per hour row in the time grid. Shared by layout math and inline styles. */
export const HOUR_HEIGHT = 56;
/** Snap-to-grid granularity (minutes) for create/move. */
export const MINUTE_SNAP = 30;
/** Minutes in one day. */
export const DAY_MINUTES = 24 * 60;
/** Smallest rendered block height (px) so tiny events stay clickable. */
export const MIN_BLOCK_HEIGHT = 16;

/** Local minutes since midnight for an ISO timestamptz. */
export function minutesSinceMidnight(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

/** Round minutes to the nearest snap step, clamped to the visible day. */
export function snapMinutes(minutes: number): number {
  const snapped = Math.round(minutes / MINUTE_SNAP) * MINUTE_SNAP;
  return Math.max(0, Math.min(DAY_MINUTES - MINUTE_SNAP, snapped));
}

/** datetime-local value ("YYYY-MM-DDTHH:mm") for a local day + minutes. */
export function minutesToLocalInput(isoDate: string, minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${isoDate}T${p(h)}:${p(m)}`;
}

/** Local ISO date (YYYY-MM-DD) of an ISO timestamptz. */
export function localDateOf(iso: string): string {
  return toISODate(new Date(iso));
}

/** Position + overlap-column info for one timed event on one day. */
export interface TimedLayout {
  topPx: number;
  heightPx: number;
  column: number;
  columns: number;
  /** Event began before midnight of this day. */
  clippedStart: boolean;
  /** Event continues past midnight of this day. */
  clippedEnd: boolean;
}

/**
 * Slice of a timed event on one local day. Returns null when the event does
 * not cover the day (callers bucket by day first). Zero-length slices (an
 * event ending exactly when another day starts) also return null.
 */
export function clipEventToDay(
  event: CalendarEvent,
  dayIso: string,
  hourHeight = HOUR_HEIGHT
): TimedLayout | null {
  const startDay = localDateOf(event.starts_at);
  const endDay = localDateOf(event.ends_at);
  if (dayIso < startDay || dayIso > endDay) return null;

  const startMin = dayIso === startDay ? minutesSinceMidnight(event.starts_at) : 0;
  const endMin =
    dayIso === endDay ? Math.min(minutesSinceMidnight(event.ends_at), DAY_MINUTES) : DAY_MINUTES;
  if (endMin <= startMin) return null;

  const px = (minutes: number) => (minutes / 60) * hourHeight;
  return {
    topPx: px(startMin),
    heightPx: Math.max(px(endMin - startMin), MIN_BLOCK_HEIGHT),
    column: 0,
    columns: 1,
    clippedStart: dayIso !== startDay,
    clippedEnd: dayIso !== endDay,
  };
}

/**
 * Position one day's timed events side-by-side so overlaps never cover each
 * other. Splits events into clusters where each event overlaps the member
 * that ends latest, then assigns columns greedily by earliest end time.
 * Every event in a cluster gets the cluster's final column count so widths
 * stay consistent.
 */
export function layoutEventColumns(
  dayIso: string,
  events: CalendarEvent[],
  hourHeight = HOUR_HEIGHT
): Map<string, TimedLayout> {
  const result = new Map<string, TimedLayout>();
  // All-day events live in the strip, not the timed axis. Callers usually
  // filter already, but this keeps the pure function safe on its own.
  const timed = events.filter((e) => !e.all_day);
  if (timed.length === 0) return result;

  const clipped = timed
    .map((e) => ({ e, layout: clipEventToDay(e, dayIso, hourHeight) }))
    .filter((x): x is { e: CalendarEvent; layout: TimedLayout } => x.layout !== null)
    .sort((a, b) => a.layout.topPx - b.layout.topPx);

  const assignCluster = (cluster: { e: CalendarEvent; layout: TimedLayout }[]) => {
    const columnByEvent = new Map<string, number>();
    const endByColumn: number[] = [];
    for (const { e, layout } of cluster) {
      let col = endByColumn.findIndex((end) => end <= layout.topPx);
      if (col === -1) col = endByColumn.length;
      endByColumn[col] = layout.topPx + layout.heightPx;
      columnByEvent.set(e.id, col);
    }
    const columns = endByColumn.length;
    for (const { e, layout } of cluster) {
      result.set(e.id, { ...layout, column: columnByEvent.get(e.id)!, columns });
    }
  };

  // Cluster by overlap with the member that ends *latest*: items are sorted
  // by start, so comparing against the last-added member is wrong when an
  // earlier member ends later (e.g. A 9-12, B 10-11, C 11:30-13 — C overlaps
  // A but not B). If the next event starts at/after the cluster's max end, it
  // cannot overlap any member and starts a new cluster.
  let cluster: { e: CalendarEvent; layout: TimedLayout }[] = [];
  let clusterEnd = 0;
  for (const item of clipped) {
    if (cluster.length > 0 && item.layout.topPx >= clusterEnd) {
      assignCluster(cluster);
      cluster = [];
      clusterEnd = 0;
    }
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.layout.topPx + item.layout.heightPx);
  }
  if (cluster.length > 0) assignCluster(cluster);
  return result;
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/calendar-grid.test.ts`
Expected: PASS (all cases). Tests use local-time ISO strings without `Z`, parsing in the runner's local timezone — same convention as `calendar-events.test.ts`.

- [x] **Step 5: Commit**

```bash
git add src/lib/calendar-grid.ts src/lib/calendar-grid.test.ts
git commit -m "feat: add time-grid helpers with tests"
```

---

## Task 2: EventEditorModal — prefilled start/end

**Files:**
- Modify: `src/components/calendar/EventEditorModal.tsx`

Phase 1's modal prefilled creation from an `initialDate` (always 09:00). Phase 2 creation flows know the **exact** time, so replace `initialDate` with `initialStart` / `initialEnd` (datetime-local values). Editing still takes precedence over both.

- [x] **Step 1: Change the props**

Replace the props block:

```tsx
export function EventEditorModal({
  workspaceId,
  event,
  initialDate,
  onClose,
}: {
  workspaceId: string;
  event: CalendarEvent | null;
  initialDate: string | null; // YYYY-MM-DD when creating from a day cell
  onClose: () => void;
}) {
```

with:

```tsx
export function EventEditorModal({
  workspaceId,
  event,
  initialStart,
  initialEnd,
  onClose,
}: {
  workspaceId: string;
  event: CalendarEvent | null;
  /** datetime-local value ("YYYY-MM-DDTHH:mm") when creating from a grid slot. */
  initialStart?: string | null;
  /** Optional explicit end; defaults to start + 30 minutes. */
  initialEnd?: string | null;
  onClose: () => void;
}) {
```

- [x] **Step 2: Update the default values**

Replace the `defaultStart`/`defaultEnd` block:

```tsx
  const defaultStart = event
    ? toLocalInput(event.starts_at)
    : `${initialDate ?? new Date().toISOString().slice(0, 10)}T09:00`;
  const defaultEnd = event
    ? toLocalInput(event.ends_at)
    : `${initialDate ?? new Date().toISOString().slice(0, 10)}T10:00`;
```

with:

```tsx
  const today = new Date().toISOString().slice(0, 10);
  const defaultStart = event ? toLocalInput(event.starts_at) : (initialStart ?? `${today}T09:00`);
  const defaultEnd = event
    ? toLocalInput(event.ends_at)
    : (initialEnd ?? (initialStart ? addMinutesLocal(initialStart, 30) : `${today}T10:00`));
```

- [x] **Step 3: Add the `addMinutesLocal` helper**

Add next to `fromLocalInput`:

```tsx
/** datetime-local value shifted by `minutes` (local). */
function addMinutesLocal(v: string, minutes: number): string {
  const d = new Date(v);
  d.setMinutes(d.getMinutes() + minutes);
  return toLocalInput(d.toISOString());
}
```

- [x] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: FAIL — `CalendarPage.tsx` still passes `initialDate`. That's expected; Task 4 fixes it. (The modal itself compiles.)

- [x] **Step 5: Commit**

```bash
git add src/components/calendar/EventEditorModal.tsx
git commit -m "feat: support prefilled start/end in EventEditorModal"
```

---

## Task 3: EventBlock + HourGrid

**Files:**
- Create: `src/components/calendar/EventBlock.tsx`
- Create: `src/components/calendar/HourGrid.tsx`

`EventBlock` is one timed event rendered as an absolutely positioned, dnd-kit draggable block (mirrors `TaskCard`'s drag pattern: `PointerSensor` with 6px distance, `CSS.Transform`, `touch-none`). `HourGrid` owns the `DndContext` and renders the full grid: sticky hour labels, one column per day (header + all-day strip + timed area), hour lines, the "now" line, event blocks, click/drag-select-to-create, and drag-to-move. `EventPill`/`TaskPill` are reused in the all-day strips.

Key interaction details implemented here:

- **Click/drag-create** uses native pointer events on the timed area with `setPointerCapture`. Pointer down on empty space records the start minute; pointer move updates a selection overlay; pointer up calls `onCreateEvent(iso, startMin, endMin)` (a sub-30-minute drag = click → 1-hour event).
- **Drag-move** uses dnd-kit: each block is a `useDraggable`, each timed area a `useDroppable` (`day:<iso>`). On drop, the new start is `snapMinutes(pointer position in the target column)` and duration is preserved; no-op when unchanged.
- **Post-drag click suppression:** a click immediately after a drop must not open the editor. `draggingRef` is set on drag start and cleared via `setTimeout(0)` on drag end — the browser dispatches `click` synchronously after `pointerup` (same task), so the flag is still set when the click fires.

- [x] **Step 1: Write EventBlock**

Create `src/components/calendar/EventBlock.tsx`:

```tsx
"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { EVENT_COLORS, eventTimeLabel } from "@/lib/calendar-events";
import { cn } from "@/lib/utils";
import type { TimedLayout } from "@/lib/calendar-grid";
import type { CalendarEvent } from "@/types/database";

export function EventBlock({
  event,
  layout,
  hourHeight,
  onOpen,
}: {
  event: CalendarEvent;
  layout: TimedLayout;
  hourHeight: number;
  onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `event:${event.id}`,
    data: { event },
  });
  // Note: `useDraggable` does not return a `transition` (unlike `useSortable`),
  // so the block animates via the CSS `transition-shadow` class only.
  const hex = EVENT_COLORS[event.color];
  const width = `calc(${100 / layout.columns}% - 2px)`;
  const left = `calc(${(layout.column / layout.columns) * 100}% + 1px)`;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      aria-label={event.title}
      title={event.title}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(event.id);
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(
        "group absolute z-10 cursor-grab touch-none select-none overflow-hidden rounded-md px-1.5 py-0.5 text-left text-[11px] leading-tight text-foreground transition-shadow duration-150 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 active:cursor-grabbing",
        isDragging && "z-20 opacity-70 shadow-lg"
      )}
      style={{
        top: layout.topPx,
        height: layout.heightPx,
        width,
        left,
        backgroundColor: `${hex}26`,
        borderLeft: `3px solid ${hex}`,
        transform: CSS.Transform.toString(transform),
      }}
    >
      <p className="line-clamp-1 font-medium">{event.title}</p>
      {layout.heightPx >= hourHeight * 0.55 && (
        <p className="line-clamp-1 text-faint">
          {eventTimeLabel(event)}
          {layout.clippedStart ? " ◄" : ""}
          {layout.clippedEnd ? " ►" : ""}
        </p>
      )}
    </div>
  );
}
```

- [x] **Step 2: Write HourGrid**

Create `src/components/calendar/HourGrid.tsx`:

```tsx
"use client";

import * as React from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from "@dnd-kit/core";
import { format } from "date-fns";

import { EventBlock } from "@/components/calendar/EventBlock";
import { EventPill } from "@/components/calendar/EventPill";
import { TaskPill } from "@/components/calendar/TaskPill";
import { toISODate } from "@/lib/calendar";
import {
  DAY_MINUTES,
  HOUR_HEIGHT,
  MINUTE_SNAP,
  layoutEventColumns,
  minutesSinceMidnight,
  snapMinutes,
  type TimedLayout,
} from "@/lib/calendar-grid";
import { cn } from "@/lib/utils";
import type { CalendarEvent, TaskWithProject } from "@/types/database";

export interface HourGridDay {
  iso: string;
  date: Date;
  tasks: TaskWithProject[];
  events: CalendarEvent[];
}

interface HourGridProps {
  days: HourGridDay[];
  onOpenEvent: (id: string) => void;
  /** Called with a snapped range when an empty slot is clicked or dragged. */
  onCreateEvent: (iso: string, startMinutes: number, endMinutes: number) => void;
  /** Persist a move (duration already preserved). */
  onMoveEvent: (id: string, startsAt: string, endsAt: string) => void;
  hourHeight?: number;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function HourGrid({
  days,
  onOpenEvent,
  onCreateEvent,
  onMoveEvent,
  hourHeight = HOUR_HEIGHT,
}: HourGridProps) {
  const todayISO = toISODate(new Date());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  // Pointer position decides the drop column (same rationale as KanbanBoard:
  // rect intersection can pick the wrong tall column and oscillate).
  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const pointerCollisions = pointerWithin(args);
    return pointerCollisions.length > 0 ? pointerCollisions : closestCorners(args);
  }, []);

  // ---- drag-to-move ----
  const draggingRef = useRef(false);

  // ---- click / drag-select-to-create ----
  const [selection, setSelection] = useState<{
    dayIso: string;
    startMin: number;
    endMin: number;
  } | null>(null);
  const selectRef = useRef<{ dayIso: string; startMin: number; endMin: number } | null>(null);

  // Per-day side-by-side layout for timed events.
  const layoutsByDay = useMemo(() => {
    const map = new Map<string, Map<string, TimedLayout>>();
    for (const day of days) {
      map.set(day.iso, layoutEventColumns(day.iso, day.events.filter((e) => !e.all_day), hourHeight));
    }
    return map;
  }, [days, hourHeight]);

  const handleSelectStart = (dayIso: string) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || e.target !== e.currentTarget) return; // empty area only
    const rect = e.currentTarget.getBoundingClientRect();
    const startMin = snapMinutes(((e.clientY - rect.top) / hourHeight) * 60);
    selectRef.current = { dayIso, startMin, endMin: startMin };
    setSelection({ dayIso, startMin, endMin: startMin });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleSelectMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const sel = selectRef.current;
    if (!sel) return;
    const rect = e.currentTarget.getBoundingClientRect();
    sel.endMin = snapMinutes(((e.clientY - rect.top) / hourHeight) * 60);
    setSelection({ dayIso: sel.dayIso, startMin: sel.startMin, endMin: sel.endMin });
  };

  const handleSelectEnd = () => {
    const sel = selectRef.current;
    if (!sel) return;
    selectRef.current = null;
    setSelection(null);
    const start = Math.min(sel.startMin, sel.endMin);
    let end = Math.max(sel.startMin, sel.endMin);
    if (end - start < MINUTE_SNAP) end = start + 60; // a click creates a 1h event
    if (end > DAY_MINUTES) end = DAY_MINUTES;
    onCreateEvent(sel.dayIso, start, end);
  };

  // A click that lands right after a drag must not open the editor. The
  // browser dispatches `click` synchronously after `pointerup` (same task),
  // so the flag is still set when it fires; the timeout clears it after.
  const guardedOpen = (id: string) => {
    if (draggingRef.current) return;
    onOpenEvent(id);
  };

  const handleDragStart = () => {
    draggingRef.current = true;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    window.setTimeout(() => {
      draggingRef.current = false;
    }, 0);

    if (!over) return;
    const dayIso = String(over.id).replace("day:", "");
    const targetDay = days.find((d) => d.iso === dayIso);
    if (!targetDay) return;

    const evt = active.data.current?.event as CalendarEvent | undefined;
    const translated = active.rect.current.translated;
    if (!evt || !translated) return;

    const minutes = snapMinutes(((translated.top - over.rect.top) / hourHeight) * 60);
    const d = new Date(targetDay.date);
    const newStart = new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      Math.floor(minutes / 60),
      minutes % 60
    );
    const durationMs = new Date(evt.ends_at).getTime() - new Date(evt.starts_at).getTime();
    const newStartISO = newStart.toISOString();
    const newEndISO = new Date(newStart.getTime() + durationMs).toISOString();
    if (newStartISO === evt.starts_at && newEndISO === evt.ends_at) return; // no-op
    onMoveEvent(evt.id, newStartISO, newEndISO);
  };

  // A cancelled drag (Escape, sensor deactivation) never reaches handleDragEnd,
  // so clear the flag here too — otherwise every later click would be swallowed.
  const handleDragCancel = () => {
    draggingRef.current = false;
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex overflow-x-auto pb-2">
        {/* Hour labels */}
        <div className="sticky left-0 z-20 w-14 shrink-0 select-none border-r border-border-subtle bg-base">
          {HOURS.map((h) => (
            <div key={h} className="relative" style={{ height: hourHeight }}>
              <span className="absolute -top-2 right-2 text-[10px] tabular-nums text-faint">
                {format(new Date(2020, 0, 1, h), "h a")}
              </span>
            </div>
          ))}
        </div>

        {days.map((day) => {
          const isToday = day.iso === todayISO;
          const timedEvents = day.events.filter((e) => !e.all_day);
          const allDayEvents = day.events.filter((e) => e.all_day);
          const layouts = layoutsByDay.get(day.iso);
          const nowTop =
            isToday ? (minutesSinceMidnight(new Date().toISOString()) / 60) * hourHeight : null;

          return (
            <div
              key={day.iso}
              className={cn(
                "flex min-w-40 flex-1 flex-col border-l border-border-subtle",
                isToday && "bg-accent-muted/5"
              )}
            >
              {/* Day header */}
              <div className="flex items-baseline justify-center gap-1.5 px-2 pb-1.5 pt-2">
                <span
                  className={cn(
                    "text-xs font-semibold",
                    isToday ? "text-accent" : "text-foreground"
                  )}
                >
                  {format(day.date, "EEE")}
                </span>
                <span className="text-xs font-medium text-faint">{day.date.getDate()}</span>
              </div>

              {/* All-day strip: all-day events + due tasks */}
              <div className="space-y-1 border-b border-border-subtle px-1.5 pb-2">
                {allDayEvents.map((e) => (
                  <EventPill key={e.id} event={e} onOpen={guardedOpen} />
                ))}
                {day.tasks.map((t) => (
                  <TaskPill key={t.id} task={t} />
                ))}
              </div>

              {/* Timed area */}
              <TimedColumn
                iso={day.iso}
                hourHeight={hourHeight}
                onPointerDown={handleSelectStart(day.iso)}
                onPointerMove={handleSelectMove}
                onPointerUp={handleSelectEnd}
              >
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="pointer-events-none absolute inset-x-0 border-t border-border-subtle/60"
                    style={{ top: h * hourHeight }}
                  />
                ))}

                {nowTop !== null && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
                    style={{ top: nowTop }}
                  >
                    <span className="size-1.5 rounded-full bg-destructive" />
                    <div className="h-px flex-1 bg-destructive" />
                  </div>
                )}

                {timedEvents.map((e) => {
                  const layout = layouts?.get(e.id);
                  if (!layout) return null;
                  return (
                    <EventBlock
                      key={e.id}
                      event={e}
                      layout={layout}
                      hourHeight={hourHeight}
                      onOpen={guardedOpen}
                    />
                  );
                })}

                {selection?.dayIso === day.iso && (
                  <div
                    className="pointer-events-none absolute z-10 rounded-md bg-accent/20 ring-1 ring-accent/40"
                    style={{
                      top: (Math.min(selection.startMin, selection.endMin) / 60) * hourHeight,
                      height:
                        (Math.abs(selection.endMin - selection.startMin) / 60) * hourHeight,
                    }}
                  />
                )}
              </TimedColumn>
            </div>
          );
        })}
      </div>
    </DndContext>
  );
}

function TimedColumn({
  iso,
  hourHeight,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  children,
}: {
  iso: string;
  hourHeight: number;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: () => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${iso}` });
  return (
    <div
      ref={setNodeRef}
      className={cn("relative flex-1", isOver && "bg-accent-muted/20")}
      style={{ height: 24 * hourHeight }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {children}
    </div>
  );
}
```

- [x] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: FAIL only at `CalendarPage.tsx` (still passes `initialDate`, still uses `WeekGrid`). `EventBlock`/`HourGrid` themselves compile.

- [x] **Step 4: Commit**

```bash
git add src/components/calendar/EventBlock.tsx src/components/calendar/HourGrid.tsx
git commit -m "feat: add HourGrid with click/drag-create and drag-to-move"
```

---

## Task 4: CalendarPage — day view + hourly week view

**Files:**
- Modify: `src/components/calendar/CalendarPage.tsx`
- Delete: `src/components/calendar/WeekGrid.tsx`, `src/components/calendar/DayCell.tsx`

Adds a "day" view, swaps the pill week grid for the hourly `HourGrid`, wires slot/drag creation into the editor, and removes the now-dead `WeekGrid`/`DayCell`.

- [x] **Step 1: Update imports**

Replace the calendar imports block in `CalendarPage.tsx`:

```tsx
import type { DayCellData } from "@/components/calendar/DayCell";
import { UnscheduledStrip } from "@/components/calendar/UnscheduledStrip";
import { WeekGrid } from "@/components/calendar/WeekGrid";
import { MonthGrid } from "@/components/calendar/MonthGrid";
import { EventEditorModal } from "@/components/calendar/EventEditorModal";
```

with:

```tsx
import { HourGrid, type HourGridDay } from "@/components/calendar/HourGrid";
import { UnscheduledStrip } from "@/components/calendar/UnscheduledStrip";
import { MonthGrid } from "@/components/calendar/MonthGrid";
import { EventEditorModal } from "@/components/calendar/EventEditorModal";
```

Add `CalendarDays` to the lucide-react import:

```tsx
import { CalendarDays, ChevronLeft, ChevronRight, CalendarRange, Download, LayoutGrid, Plus, Rows3 } from "lucide-react";
```

Add the `minutesToLocalInput` import (after the `bucketEventsByDate` import):

```tsx
import { minutesToLocalInput } from "@/lib/calendar-grid";
```

And add `format` from date-fns (new import line after the lucide import):

```tsx
import { format } from "date-fns";
```

- [x] **Step 2: Add the day view to the view type + state**

Change `type CalendarView = "week" | "month";` to:

```tsx
type CalendarView = "day" | "week" | "month";
```

Replace the editor state block:

```tsx
  const [editorEvent, setEditorEvent] = useState<CalendarEvent | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [createDate, setCreateDate] = useState<string | null>(null);
```

with:

```tsx
  const [editorEvent, setEditorEvent] = useState<CalendarEvent | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [createStart, setCreateStart] = useState<string | null>(null);
  const [createEnd, setCreateEnd] = useState<string | null>(null);
```

- [x] **Step 3: Compute the visible range for all three views**

Replace:

```tsx
  const from = view === "week" ? weekDates[0] : monthDays[0].iso;
  const to = view === "week" ? weekDates[6] : monthDays[41].iso;
```

with:

```tsx
  const dayISO = toISODate(anchor);
  const from = view === "week" ? weekDates[0] : view === "day" ? dayISO : monthDays[0].iso;
  const to = view === "week" ? weekDates[6] : view === "day" ? dayISO : monthDays[41].iso;
```

- [x] **Step 4: Build the hourly-grid day list**

`hourDays` reads `byDate` and `eventsByDate`, so add it **after** the `byDate` memo block (which sits after `eventsByDate` in the file) — e.g. directly after the `const { byDate, unscheduled } = useMemo(...)` block:

```tsx
  const hourDays: HourGridDay[] = useMemo(() => {
    const dates = view === "day" ? [anchor] : weekDates.map((iso, i) => addDays(weekStart, i));
    return dates.map((date) => {
      const iso = toISODate(date);
      return { iso, date, tasks: byDate.get(iso) ?? [], events: eventsByDate.get(iso) ?? [] };
    });
  }, [view, anchor, weekDates, weekStart, byDate, eventsByDate]);
```

- [x] **Step 5: Replace the open/close handlers**

Replace:

```tsx
  const openEvent = (id: string) => {
    const found = (events ?? []).find((e) => e.id === id) ?? null;
    setEditorEvent(found);
    setCreateDate(null);
    setEditorOpen(true);
  };

  const newEvent = () => {
    setEditorEvent(null);
    setCreateDate(todayISO);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditorEvent(null);
    setCreateDate(null);
  };
```

with:

```tsx
  const openEvent = (id: string) => {
    const found = (events ?? []).find((e) => e.id === id) ?? null;
    setEditorEvent(found);
    setCreateStart(null);
    setCreateEnd(null);
    setEditorOpen(true);
  };

  const openCreateAt = (iso: string, startMinutes: number, endMinutes: number) => {
    setEditorEvent(null);
    setCreateStart(minutesToLocalInput(iso, startMinutes));
    setCreateEnd(minutesToLocalInput(iso, endMinutes));
    setEditorOpen(true);
  };

  const newEvent = () => {
    setEditorEvent(null);
    setCreateStart(`${todayISO}T09:00`);
    setCreateEnd(`${todayISO}T10:00`);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditorEvent(null);
    setCreateStart(null);
    setCreateEnd(null);
  };
```

- [x] **Step 6: Day-view navigation**

Replace `goBack`/`goForward`/`goToday`:

```tsx
  const goBack = () => {
    if (view === "week") setAnchor(addDays(weekStart, -7));
    else if (view === "day") setAnchor(addDays(anchor, -1));
    else setAnchor(new Date(monthYear, monthMonth - 1, 1));
  };

  const goForward = () => {
    if (view === "week") setAnchor(addDays(weekStart, 7));
    else if (view === "day") setAnchor(addDays(anchor, 1));
    else setAnchor(new Date(monthYear, monthMonth + 1, 1));
  };

  const goToday = () =>
    setAnchor(view === "week" ? startOfWeek(new Date()) : new Date());
```

- [x] **Step 7: Remove the old cell builders**

Delete the `weekDayCells` and `monthDayCells` builders (the month grid now gets its cells from `buildMonthGrid` directly; day/week use `hourDays`). Replace:

```tsx
  const weekDayCells: DayCellData[] = weekDates.map((iso, i) => ({
    iso,
    date: addDays(weekStart, i),
    tasks: byDate.get(iso) ?? [],
    events: eventsByDate.get(iso) ?? [],
    hasNote: hasNote.has(iso),
    isToday: iso === todayISO,
  }));

  const monthDayCells = monthDays.map((d) => ({
    ...d,
    tasks: byDate.get(d.iso) ?? [],
    events: eventsByDate.get(d.iso) ?? [],
    hasNote: hasNote.has(d.iso),
    isToday: d.iso === todayISO,
  }));
```

with:

```tsx
  const monthDayCells = monthDays.map((d) => ({
    ...d,
    tasks: byDate.get(d.iso) ?? [],
    events: eventsByDate.get(d.iso) ?? [],
    hasNote: hasNote.has(d.iso),
    isToday: d.iso === todayISO,
  }));
```

- [x] **Step 8: Day heading + move-event handler**

Replace:

```tsx
  const heading = view === "week"
    ? formatWeekRange(weekStart)
    : formatMonthYear(monthYear, monthMonth);
```

with:

```tsx
  const heading = view === "week"
    ? formatWeekRange(weekStart)
    : view === "day"
      ? format(anchor, "EEEE, MMM d, yyyy")
      : formatMonthYear(monthYear, monthMonth);
```

After `goToday`, add the move handler (uses the existing `useUpdateEvent` pattern via a wrapper passed into `HourGrid`):

```tsx
  const moveEvent = (id: string, startsAt: string, endsAt: string) => {
    updateEvent.mutate(
      { id, patch: { starts_at: startsAt, ends_at: endsAt } },
      { onError: () => toast.error("Couldn't move the event") }
    );
  };
```

> **Note:** `updateEvent` comes from the existing `useUpdateEvent(workspaceId)` hook — add `const updateEvent = useUpdateEvent(workspaceId);` next to the other hook calls (after `const { data: events } = useEvents(...)`), and add `import { toast } from "sonner";` to the imports. The grid needs the event in the cache to compute the move; `useEvents` already fetched it.

- [x] **Step 9: View toggle — add the Day button**

In the view-toggle `div`, add a day button before the week button:

```tsx
              <button
                type="button"
                onClick={() => setView("day")}
                aria-label="Day view"
                className={cn(
                  "rounded-md p-1.5 transition-colors",
                  view === "day" ? "bg-accent-muted text-accent" : "text-secondary hover:text-foreground"
                )}
              >
                <CalendarDays className="size-3.5" strokeWidth={1.75} />
              </button>
```

- [x] **Step 10: Render HourGrid for day/week, keep MonthGrid**

Replace the view render block:

```tsx
      {view === "week" ? (
        tasks?.length === 0 && (events?.length ?? 0) === 0 ? (
          <EmptyState
            icon={CalendarRange}
            title="Nothing scheduled yet"
            description="Add an event, or give a task a due date, and it will appear here."
          />
        ) : (
          <>
            <WeekGrid days={weekDayCells} onOpenEvent={openEvent} />
            <UnscheduledStrip tasks={unscheduled} />
          </>
        )
      ) : (
        <MonthGrid days={monthDayCells} onOpenTask={openTask} onOpenEvent={openEvent} />
      )}
```

with:

```tsx
      {view === "month" ? (
        <MonthGrid days={monthDayCells} onOpenTask={openTask} onOpenEvent={openEvent} />
      ) : view === "day" ? (
        <>
          <HourGrid
            days={hourDays}
            onOpenEvent={openEvent}
            onCreateEvent={openCreateAt}
            onMoveEvent={moveEvent}
          />
          <UnscheduledStrip tasks={unscheduled} />
        </>
      ) : tasks?.length === 0 && (events?.length ?? 0) === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="Nothing scheduled yet"
          description="Add an event, or give a task a due date, and it will appear here."
        />
      ) : (
        <>
          <HourGrid
            days={hourDays}
            onOpenEvent={openEvent}
            onCreateEvent={openCreateAt}
            onMoveEvent={moveEvent}
          />
          <UnscheduledStrip tasks={unscheduled} />
        </>
      )}
```

- [x] **Step 11: Update the modal props**

Replace:

```tsx
      {editorOpen && (
        <EventEditorModal
          workspaceId={workspace.id}
          event={editorEvent}
          initialDate={createDate}
          onClose={closeEditor}
        />
      )}
```

with:

```tsx
      {editorOpen && (
        <EventEditorModal
          workspaceId={workspace.id}
          event={editorEvent}
          initialStart={createStart}
          initialEnd={createEnd}
          onClose={closeEditor}
        />
      )}
```

- [x] **Step 12: Verify the HourGrid props**

`onMoveEvent` was already added as a required prop in Task 3 — confirm `CalendarPage` passes it (Step 10) and `HourGrid` destructures it. No code change needed here.

- [x] **Step 13: Delete the dead grid components**

```bash
git rm src/components/calendar/WeekGrid.tsx src/components/calendar/DayCell.tsx
```

- [x] **Step 14: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS. (`DayCell.tsx` and `WeekGrid.tsx` are gone; `TaskPill`/`EventPill` are still imported by `HourGrid`, so nothing is orphaned.)

- [x] **Step 15: Build**

Run: `npm run build`
Expected: build succeeds.

- [x] **Step 16: Commit**

```bash
git add src/components/calendar/CalendarPage.tsx src/components/calendar/HourGrid.tsx
git commit -m "feat: hourly day and week views with create and move"
```

---

## Task 5: Full validation

**Files:** none (verification only).

- [x] **Step 1: Unit tests**

Run: `npx vitest run`
Expected: all suites pass (existing 99 + `calendar-grid.test.ts`).

- [x] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [x] **Step 3: Lint**

Run: `npm run lint`
Expected: no new errors (2 pre-existing errors live in `src/components/voice-agent/VoiceAgent.tsx`, untouched).

- [x] **Step 4: Build**

Run: `npm run build`
Expected: build succeeds.

---

## Task 6: Manual UAT

**Files:** none (verification only).

- [ ] **Step 1: Run the app**

Run: `npm run dev`. Open `/calendar` (needs a local Supabase stack + a logged-in workspace; the `events` table from Phase 1 must be applied).

- [ ] **Step 2: Verify week view + day toggle**

Week view shows the hourly grid: hour labels on the left, seven day columns, all-day strips with tasks. Switch to day view (CalendarDays icon) — a single column with a full-day heading; prev/next steps one day.

- [ ] **Step 3: Verify click-to-create**

In day view, click an empty slot at 10:00 → editor opens with Start = today 10:00, End = 10:30 → set title "Standup" → Create. The block renders at 10:00–10:30 in the correct column.

- [ ] **Step 4: Verify drag-to-create**

In week view, pointer down on an empty slot in Wednesday's column at 9:00, drag to 10:30 → selection overlay follows → release → editor opens with 09:00–10:30 → Create. Block appears Wednesday 09:00–10:30.

- [ ] **Step 5: Verify drag-to-move**

Drag an existing block vertically to 14:00 → it moves, duration preserved. Drag the same block to Thursday's column → it lands on Thursday at the dropped time. Confirm a plain click on a block opens the editor (no accidental open after dragging).

- [ ] **Step 6: Verify overlap layout**

Create two events that overlap (09:00–10:00 and 09:30–10:30) → they render side-by-side, each half-width. Create a third non-overlapping event → full width.

- [ ] **Step 7: Verify midnight spanning + all-day**

Create an event 23:30–00:30 → appears on both days with ◄/► markers on the clipped edge. Create an all-day event → renders in the all-day strip (label "All day"). Tasks still render in the all-day strip.

- [ ] **Step 8: Verify month view + validation**

Month view still renders the pill grid with events; clicking an event opens the editor. Setting end before start shows "End must be after start"; empty title shows "Title is required".

---

## Self-Review Notes

- **Spec coverage:** Day view ✓ (Tasks 3–4); hourly Week view ✓ (Tasks 3–4); events positioned by time ✓ (Task 1 `clipEventToDay`/`layoutEventColumns`); click-empty-slot create ✓ (Task 3 `handleSelectEnd` 1h default); drag-to-create ✓ (Task 3 selection overlay); drag-to-move ✓ (Task 3 dnd-kit drop math). Resize explicitly deferred (non-goal). Tasks keep rendering alongside (all-day strips) per the spec's "tasks continue to render unchanged."
- **Consistency:** dnd-kit usage mirrors `KanbanBoard` (`PointerSensor` 6px, `pointerWithin` collision fallback, `CSS.Transform`, `touch-none`). Pure helpers + vitest matches the repo's no-RTL convention. `useEvents`/`useUpdateEvent`/`EventEditorModal`/`EventPill`/`TaskPill`/`EVENT_COLORS` are reused, not duplicated.
- **Known intentional intermediate failures:** typecheck fails after Task 2 (CalendarPage still passes `initialDate`) and during Task 3/4 transitions; the plan calls these out so the executor doesn't treat them as defects. Final state (after Task 4) typechecks, lints, builds, and passes all tests.
- **Time-zone handling:** all grid math uses local time (same as Phase 1 bucketing); `starts_at` stays UTC in the DB via `toISOString()`.
- **Edge cases covered:** zero-length clips return null; `snapMinutes` clamps to the day; `layoutEventColumns` reuses columns after an event ends; the chain A→B→C cluster test pins the greedy behavior; post-drag click suppression prevents accidental editor opens.
- **Accessibility:** `EventBlock` is focusable (`role="button"`, Enter opens); drag is keyboard-friendly via native focus + click fallback (keyboard drag is a documented future enhancement, matching `TaskCard`).
