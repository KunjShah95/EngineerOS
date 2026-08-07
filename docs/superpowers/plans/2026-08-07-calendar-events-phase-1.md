# Calendar Events — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a timed **Events** concept to the EngineerOS calendar — a database table, types, CRUD hooks, an event editor modal, and rendering of events alongside tasks on the existing week and month grids.

**Architecture:** New `events` table follows the existing entity pattern (`workspace_id` FK, RLS on `owner_id = auth.uid()`, `deleted_at` soft-delete). React Query hooks in `useEvents.ts` mirror `useSnippets.ts`. Pure date/label logic lives in `src/lib/calendar-events.ts` (unit-tested with vitest). UI (`EventEditorModal`, `EventPill`) reuses shadcn `Dialog` and `sonner` toasts; `CalendarPage` merges events into the day-cell buckets it already builds. Recurrence and reminder columns are created now but left dormant until later phases.

**Tech Stack:** Next.js (App Router), React Query (`@tanstack/react-query`), Supabase JS client, shadcn/ui (`Dialog`, `Button`, `Input`, `Textarea`, `Select`, `Switch`, `Label`), `sonner`, `lucide-react`, vitest.

---

## File Structure

**Create:**
- `supabase/migrations/20260807000001_calendar_events.sql` — `events` table, RLS, index.
- `src/lib/calendar-events.ts` — pure helpers: `bucketEventsByDate`, `eventTimeLabel`, `EVENT_COLORS`.
- `src/lib/calendar-events.test.ts` — vitest unit tests for the helpers.
- `src/hooks/useEvents.ts` — `useEvents`, `useCreateEvent`, `useUpdateEvent`, `useDeleteEvent`.
- `src/components/calendar/EventPill.tsx` — one event rendered as a colored pill.
- `src/components/calendar/EventEditorModal.tsx` — create/edit form in a `Dialog`.

**Modify:**
- `src/types/database.ts` — add `EventColor` + `CalendarEvent` interfaces.
- `src/components/calendar/DayCell.tsx` — accept `events` + `onOpenEvent`, render `EventPill`s.
- `src/components/calendar/WeekGrid.tsx` — pass `onOpenEvent` through to `DayCell`.
- `src/components/calendar/MonthGrid.tsx` — accept + render events, add `onOpenEvent`.
- `src/components/calendar/CalendarPage.tsx` — load events for the visible range, bucket them, wire "New event" button + editor open/close, pass events into grids.

---

## Task 1: Events table migration

**Files:**
- Create: `supabase/migrations/20260807000001_calendar_events.sql`

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Apply the migration**

Run: `supabase db push`
Expected: applies `20260807000001_calendar_events.sql` with no error. (If Supabase is not running locally, note that the SQL must be applied via the Supabase dashboard SQL editor before the app can read/write events.)

- [ ] **Step 3: Lint the schema**

Run: `npm run db:lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260807000001_calendar_events.sql
git commit -m "feat: add events table for calendar events"
```

---

## Task 2: Types

**Files:**
- Modify: `src/types/database.ts` (add after the `TaskComment` interface, around line 76)

- [ ] **Step 1: Add the types**

Insert into `src/types/database.ts`:

```ts
export type EventColor = 'blue' | 'green' | 'red' | 'amber' | 'purple' | 'gray';

/** A timed calendar event. Named CalendarEvent to avoid clashing with DOM `Event`. */
export interface CalendarEvent {
  id: string;
  workspace_id: string;
  title: string;
  description: string;
  location: string | null;
  color: EventColor;
  all_day: boolean;
  starts_at: string; // ISO timestamptz
  ends_at: string;   // ISO timestamptz
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

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/types/database.ts
git commit -m "feat: add CalendarEvent and EventColor types"
```

---

## Task 3: Pure helpers + tests (TDD)

**Files:**
- Create: `src/lib/calendar-events.ts`
- Test: `src/lib/calendar-events.test.ts`

The helpers are pure so they can be unit-tested (there is no React Testing Library in this repo). `bucketEventsByDate` maps events to local ISO dates using the existing `toISODate` from `src/lib/calendar.ts`; an event that spans midnight appears on each local day it covers. `eventTimeLabel` formats a compact time range for a pill. `EVENT_COLORS` maps each `EventColor` to a hex value for inline styles (matching how `MonthGrid` styles task pills with hex).

- [ ] **Step 1: Write the failing test**

Create `src/lib/calendar-events.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { bucketEventsByDate, eventTimeLabel, EVENT_COLORS } from "./calendar-events";
import type { CalendarEvent } from "@/types/database";

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

describe("bucketEventsByDate", () => {
  it("buckets a single-day event on its local date", () => {
    const e = evt({ id: "a", starts_at: "2026-08-07T09:00:00", ends_at: "2026-08-07T10:00:00" });
    const map = bucketEventsByDate([e]);
    expect(map.get("2026-08-07")?.map((x) => x.id)).toEqual(["a"]);
  });

  it("puts a midnight-spanning event on both local days", () => {
    const e = evt({ id: "b", starts_at: "2026-08-07T23:00:00", ends_at: "2026-08-08T01:00:00" });
    const map = bucketEventsByDate([e]);
    expect(map.get("2026-08-07")?.map((x) => x.id)).toEqual(["b"]);
    expect(map.get("2026-08-08")?.map((x) => x.id)).toEqual(["b"]);
  });

  it("returns an empty map for no events", () => {
    expect(bucketEventsByDate([]).size).toBe(0);
  });
});

describe("eventTimeLabel", () => {
  it("returns 'All day' for all-day events", () => {
    const e = evt({ all_day: true, starts_at: "2026-08-07T00:00:00", ends_at: "2026-08-07T00:00:00" });
    expect(eventTimeLabel(e)).toBe("All day");
  });

  it("formats a start time in H:MM form", () => {
    const e = evt({ starts_at: "2026-08-07T09:05:00", ends_at: "2026-08-07T10:00:00" });
    expect(eventTimeLabel(e)).toBe("9:05");
  });
});

describe("EVENT_COLORS", () => {
  it("has a hex value for every color", () => {
    for (const c of ["blue", "green", "red", "amber", "purple", "gray"] as const) {
      expect(EVENT_COLORS[c]).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/calendar-events.test.ts`
Expected: FAIL — cannot resolve `./calendar-events`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/calendar-events.ts`:

```ts
import { toISODate } from "@/lib/calendar";
import type { CalendarEvent, EventColor } from "@/types/database";

/** Hex per color token — used for inline pill styling (matches MonthGrid task pills). */
export const EVENT_COLORS: Record<EventColor, string> = {
  blue: "#3b82f6",
  green: "#22c55e",
  red: "#ef4444",
  amber: "#f59e0b",
  purple: "#a855f7",
  gray: "#6b7280",
};

/** Group events by every local ISO date they cover (inclusive of start and end day). */
export function bucketEventsByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const start = new Date(e.starts_at);
    const end = new Date(e.ends_at);
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    while (cursor <= last) {
      const iso = toISODate(cursor);
      const list = map.get(iso) ?? [];
      list.push(e);
      map.set(iso, list);
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return map;
}

/** Compact time label for a pill: "All day" or the start time as "H:MM". */
export function eventTimeLabel(e: CalendarEvent): string {
  if (e.all_day) return "All day";
  const d = new Date(e.starts_at);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/calendar-events.test.ts`
Expected: PASS (all cases). Note: tests use local-time ISO strings without a `Z` suffix so they parse in the runner's local timezone, matching how the app stores/reads workspace-local times.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calendar-events.ts src/lib/calendar-events.test.ts
git commit -m "feat: add calendar-events helpers with tests"
```

---

## Task 4: CRUD hooks

**Files:**
- Create: `src/hooks/useEvents.ts`

Mirrors `src/hooks/useSnippets.ts`. `useEvents` takes the visible range and returns non-deleted events overlapping it (`starts_at <= to` AND `ends_at >= from`). `from`/`to` are ISO dates (`YYYY-MM-DD`); comparing them against `timestamptz` works because `'2026-08-07' <= '2026-08-07T09:00:00'` string/timestamp coercion is handled by Postgres. To be safe against the end-of-day boundary, `to` is compared with an appended end-of-day.

- [ ] **Step 1: Write the hooks**

Create `src/hooks/useEvents.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import type { CalendarEvent } from "@/types/database";

/** Non-deleted events overlapping [fromISO, toISO] (both YYYY-MM-DD). */
export function useEvents(workspaceId: string | null, fromISO: string, toISO: string) {
  return useQuery({
    queryKey: ["events", workspaceId ?? "", fromISO, toISO],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .is("deleted_at", null)
        .lte("starts_at", `${toISO}T23:59:59`)
        .gte("ends_at", `${fromISO}T00:00:00`)
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CalendarEvent[];
    },
    enabled: Boolean(workspaceId),
  });
}

export type EventInput = Partial<
  Pick<
    CalendarEvent,
    "title" | "description" | "location" | "color" | "all_day" | "starts_at" | "ends_at"
  >
>;

export function useCreateEvent(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: EventInput) => {
      const supabase = createClient();
      const now = new Date();
      const oneHour = new Date(now.getTime() + 60 * 60 * 1000);
      const { data, error } = await supabase
        .from("events")
        .insert({
          workspace_id: workspaceId,
          title: input.title ?? "New event",
          description: input.description ?? "",
          location: input.location ?? null,
          color: input.color ?? "blue",
          all_day: input.all_day ?? false,
          starts_at: input.starts_at ?? now.toISOString(),
          ends_at: input.ends_at ?? oneHour.toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      return data as CalendarEvent;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["events", workspaceId ?? ""] });
    },
  });
}

export function useUpdateEvent(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: EventInput }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("events")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as CalendarEvent;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["events", workspaceId ?? ""] });
    },
  });
}

export function useDeleteEvent(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("events")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["events", workspaceId ?? ""] });
    },
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useEvents.ts
git commit -m "feat: add event CRUD hooks"
```

---

## Task 5: EventPill component

**Files:**
- Create: `src/components/calendar/EventPill.tsx`

Renders one event as a colored pill (mirrors `TaskPill`, but a `button` that calls `onOpen`, not a `Link`). Uses `EVENT_COLORS` + `eventTimeLabel`.

- [ ] **Step 1: Write the component**

Create `src/components/calendar/EventPill.tsx`:

```tsx
import { EVENT_COLORS, eventTimeLabel } from "@/lib/calendar-events";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/types/database";

export function EventPill({
  event,
  onOpen,
}: {
  event: CalendarEvent;
  onOpen: (id: string) => void;
}) {
  const hex = EVENT_COLORS[event.color];
  return (
    <button
      type="button"
      onClick={() => onOpen(event.id)}
      className={cn(
        "group flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs text-foreground transition-colors duration-150 hover:opacity-80"
      )}
      style={{ backgroundColor: `${hex}22`, borderLeft: `2px solid ${hex}` }}
    >
      <span className="shrink-0 text-[10px] font-medium text-faint">{eventTimeLabel(event)}</span>
      <span className="line-clamp-1 min-w-0">{event.title}</span>
    </button>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/calendar/EventPill.tsx
git commit -m "feat: add EventPill component"
```

---

## Task 6: EventEditorModal component

**Files:**
- Create: `src/components/calendar/EventEditorModal.tsx`

A `Dialog`-based create/edit form. Controlled from `CalendarPage`. When `event` is `null` it creates (with `initialDate` prefilling the start); otherwise it edits. Validates `ends_at >= starts_at`. Uses `sonner` toasts and the event hooks. Datetime handling: `<input type="datetime-local">` gives/consumes `YYYY-MM-DDTHH:mm` (local, no zone); helpers convert to/from ISO.

- [ ] **Step 1: Write the component**

Create `src/components/calendar/EventEditorModal.tsx`:

```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateEvent, useUpdateEvent, useDeleteEvent } from "@/hooks/useEvents";
import type { CalendarEvent, EventColor } from "@/types/database";

const COLORS: EventColor[] = ["blue", "green", "red", "amber", "purple", "gray"];

/** ISO timestamptz -> value for <input type="datetime-local"> (local, no zone). */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** datetime-local value -> ISO timestamptz. */
function fromLocalInput(v: string): string {
  return new Date(v).toISOString();
}

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
  const isEdit = event !== null;
  const createEvent = useCreateEvent(workspaceId);
  const updateEvent = useUpdateEvent(workspaceId);
  const deleteEvent = useDeleteEvent(workspaceId);

  const defaultStart = event
    ? toLocalInput(event.starts_at)
    : `${initialDate ?? new Date().toISOString().slice(0, 10)}T09:00`;
  const defaultEnd = event
    ? toLocalInput(event.ends_at)
    : `${initialDate ?? new Date().toISOString().slice(0, 10)}T10:00`;

  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [color, setColor] = useState<EventColor>(event?.color ?? "blue");
  const [allDay, setAllDay] = useState(event?.all_day ?? false);
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);

  const submit = () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    const startsAt = fromLocalInput(start);
    const endsAt = fromLocalInput(end);
    if (new Date(endsAt) < new Date(startsAt)) {
      toast.error("End must be after start");
      return;
    }
    const payload = {
      title: title.trim(),
      description,
      location: location.trim() || null,
      color,
      all_day: allDay,
      starts_at: startsAt,
      ends_at: endsAt,
    };
    if (isEdit) {
      updateEvent.mutate(
        { id: event.id, patch: payload },
        { onSuccess: () => { toast.success("Event saved"); onClose(); } }
      );
    } else {
      createEvent.mutate(payload, {
        onSuccess: () => { toast.success("Event created"); onClose(); },
      });
    }
  };

  const remove = () => {
    if (!event) return;
    deleteEvent.mutate(event.id, {
      onSuccess: () => { toast.success("Event deleted"); onClose(); },
    });
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit event" : "New event"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="event-title">Title</Label>
            <Input
              id="event-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title"
              autoFocus
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="event-allday">All day</Label>
            <Switch id="event-allday" checked={allDay} onCheckedChange={setAllDay} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="event-start">Start</Label>
              <Input
                id="event-start"
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-end">End</Label>
              <Input
                id="event-end"
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-location">Location</Label>
            <Input
              id="event-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Color</Label>
            <Select value={color} onValueChange={(v) => setColor(v as EventColor)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLORS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-desc">Description</Label>
            <Textarea
              id="event-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          {isEdit ? (
            <Button variant="ghost" size="sm" onClick={remove} aria-label="Delete event">
              <Trash2 className="size-4" strokeWidth={1.75} />
              Delete
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={submit}>{isEdit ? "Save" : "Create"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS. If `Textarea`, `Switch`, or `Select` import paths error, confirm the files exist under `src/components/ui/` (they do: `textarea.tsx`, `switch.tsx`, `select.tsx`) and match the named exports used above.

- [ ] **Step 3: Commit**

```bash
git add src/components/calendar/EventEditorModal.tsx
git commit -m "feat: add EventEditorModal"
```

---

## Task 7: Render events in DayCell + WeekGrid

**Files:**
- Modify: `src/components/calendar/DayCell.tsx`
- Modify: `src/components/calendar/WeekGrid.tsx`

- [ ] **Step 1: Update DayCell to accept and render events**

Replace `src/components/calendar/DayCell.tsx` with:

```tsx
import Link from "next/link";

import { TaskPill } from "@/components/calendar/TaskPill";
import { EventPill } from "@/components/calendar/EventPill";
import { cn } from "@/lib/utils";
import type { CalendarEvent, TaskWithProject } from "@/types/database";
import { weekdayName } from "@/lib/calendar";

export interface DayCellData {
  iso: string;
  date: Date;
  tasks: TaskWithProject[];
  events: CalendarEvent[];
  hasNote: boolean;
  isToday: boolean;
}

export function DayCell({
  iso,
  date,
  tasks,
  events,
  hasNote,
  isToday,
  onOpenEvent,
}: DayCellData & { onOpenEvent: (id: string) => void }) {
  return (
    <div
      className={cn(
        "flex min-h-[120px] flex-col rounded-lg border border-border-subtle bg-surface p-2",
        isToday && "border-accent/60"
      )}
    >
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-[11px] font-medium text-faint">{weekdayName(date)}</span>
        <span className={cn("text-xs font-semibold", isToday ? "text-accent" : "text-foreground")}>
          {date.getDate()}
        </span>
      </div>

      <div className="mt-1.5 flex flex-1 flex-col gap-1.5">
        {events.map((event) => (
          <EventPill key={event.id} event={event} onOpen={onOpenEvent} />
        ))}
        {tasks.map((task) => (
          <TaskPill key={task.id} task={task} />
        ))}
      </div>

      <div className="mt-1.5 border-t border-border-subtle pt-1">
        <Link
          href={`/daily/${iso}`}
          className={cn(
            "text-[11px] font-medium transition-colors",
            hasNote ? "text-accent hover:text-accent-hover" : "text-faint hover:text-foreground"
          )}
        >
          {hasNote ? "Open note" : "Daily"}
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update WeekGrid to pass onOpenEvent through**

Replace `src/components/calendar/WeekGrid.tsx` with:

```tsx
import { DayCell, type DayCellData } from "@/components/calendar/DayCell";

export function WeekGrid({
  days,
  onOpenEvent,
}: {
  days: DayCellData[];
  onOpenEvent: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7 lg:gap-1.5">
      {days.map((day) => (
        <DayCell key={day.iso} {...day} onOpenEvent={onOpenEvent} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: FAIL — `CalendarPage.tsx` does not yet supply `events` / `onOpenEvent`. This is expected; Task 9 wires it. (DayCell/WeekGrid themselves compile.)

- [ ] **Step 4: Commit**

```bash
git add src/components/calendar/DayCell.tsx src/components/calendar/WeekGrid.tsx
git commit -m "feat: render events in DayCell and WeekGrid"
```

---

## Task 8: Render events in MonthGrid

**Files:**
- Modify: `src/components/calendar/MonthGrid.tsx`

Add events above tasks in each month cell; clicking an event calls `onOpenEvent`. Keep the existing 3-item visible cap applied to the combined list so a busy day doesn't overflow.

- [ ] **Step 1: Update MonthGrid**

Replace `src/components/calendar/MonthGrid.tsx` with:

```tsx
"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { priorityColor } from "@/lib/task-meta";
import { EVENT_COLORS } from "@/lib/calendar-events";
import type { CalendarEvent, TaskWithProject } from "@/types/database";

interface MonthDay {
  iso: string;
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  tasks: TaskWithProject[];
  events: CalendarEvent[];
  hasNote: boolean;
}

interface MonthGridProps {
  days: MonthDay[];
  onOpenTask: (id: string) => void;
  onOpenEvent: (id: string) => void;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function MonthGrid({ days, onOpenTask, onOpenEvent }: MonthGridProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-default">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-default bg-surface">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-secondary">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const visibleEvents = day.events.slice(0, 2);
          const taskBudget = Math.max(0, 3 - visibleEvents.length);
          const visibleTasks = day.tasks.slice(0, taskBudget);
          const overflow =
            day.events.length + day.tasks.length - visibleEvents.length - visibleTasks.length;

          return (
            <div
              key={day.iso}
              className={cn(
                "min-h-[100px] border-border-subtle p-1.5",
                i % 7 !== 6 && "border-r",
                i < days.length - 7 && "border-b",
                !day.isCurrentMonth && "bg-surface/40",
                day.isToday && "bg-accent-muted/10"
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <Link
                  href={`/daily/${day.iso}`}
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs font-medium transition-colors hover:bg-surface-hover",
                    day.isToday && "bg-accent text-accent-foreground hover:bg-accent",
                    !day.isCurrentMonth && "text-faint"
                  )}
                >
                  {day.date.getDate()}
                </Link>
                {day.hasNote && (
                  <span className="size-1.5 rounded-full bg-accent" title="Has daily note" />
                )}
              </div>

              <div className="space-y-0.5">
                {visibleEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => onOpenEvent(event.id)}
                    className="w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] leading-tight text-foreground transition-colors hover:opacity-80"
                    style={{
                      backgroundColor: `${EVENT_COLORS[event.color]}22`,
                      borderLeft: `2px solid ${EVENT_COLORS[event.color]}`,
                    }}
                  >
                    {event.title}
                  </button>
                ))}
                {visibleTasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onOpenTask(task.id)}
                    className={cn(
                      "w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] leading-tight transition-colors hover:opacity-80",
                      task.status === "done"
                        ? "text-faint line-through"
                        : "text-foreground"
                    )}
                    style={{
                      backgroundColor: `${priorityColor(task.priority)}22`,
                      borderLeft: `2px solid ${priorityColor(task.priority)}`,
                    }}
                  >
                    {task.title}
                  </button>
                ))}
                {overflow > 0 && (
                  <span className="block px-1 text-[10px] text-faint">
                    +{overflow} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: still FAIL only at `CalendarPage.tsx` (unresolved props) — MonthGrid itself compiles. Fixed in Task 9.

- [ ] **Step 3: Commit**

```bash
git add src/components/calendar/MonthGrid.tsx
git commit -m "feat: render events in MonthGrid"
```

---

## Task 9: Wire CalendarPage — load, bucket, create, edit

**Files:**
- Modify: `src/components/calendar/CalendarPage.tsx`

Add event loading for the visible range, bucket events by date, add a "New event" button, and manage editor open state (create vs edit). Pass `events` + `onOpenEvent` into both grids.

- [ ] **Step 1: Add imports**

In `src/components/calendar/CalendarPage.tsx`, add to the existing imports:

```tsx
import { Plus } from "lucide-react";
import { EventEditorModal } from "@/components/calendar/EventEditorModal";
import { useEvents } from "@/hooks/useEvents";
import { bucketEventsByDate } from "@/lib/calendar-events";
import type { CalendarEvent, TaskWithProject } from "@/types/database";
```

(The `TaskWithProject` import already exists — do not duplicate it; add only the new imports.)

- [ ] **Step 2: Add editor state and event data**

After the existing `const openTaskId = searchParams.get("task");` line, add:

```tsx
const [editorEvent, setEditorEvent] = useState<CalendarEvent | null>(null);
const [editorOpen, setEditorOpen] = useState(false);
const [createDate, setCreateDate] = useState<string | null>(null);
```

After the `const { data: noteDates } = useDailyNotesInRange(...)` line, add:

```tsx
const { data: events } = useEvents(workspaceId, from, to);
const eventsByDate = useMemo(() => bucketEventsByDate(events ?? []), [events]);
```

- [ ] **Step 3: Add open/close handlers**

After the existing `closeTask` function, add:

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

- [ ] **Step 4: Add events into the day-cell builders**

Change `weekDayCells` and `monthDayCells` to include events. Replace the existing `weekDayCells` mapping with:

```tsx
const weekDayCells: DayCellData[] = weekDates.map((iso, i) => ({
  iso,
  date: addDays(weekStart, i),
  tasks: byDate.get(iso) ?? [],
  events: eventsByDate.get(iso) ?? [],
  hasNote: hasNote.has(iso),
  isToday: iso === todayISO,
}));
```

Replace the existing `monthDayCells` mapping with:

```tsx
const monthDayCells = monthDays.map((d) => ({
  ...d,
  tasks: byDate.get(d.iso) ?? [],
  events: eventsByDate.get(d.iso) ?? [],
  hasNote: hasNote.has(d.iso),
  isToday: d.iso === todayISO,
}));
```

- [ ] **Step 5: Add the "New event" button to the header actions**

In the `PageHeader` `actions` prop, add this button as the first child inside the `<div className="flex items-center gap-1">` (before the iCal export `Button`):

```tsx
<Button variant="ghost" size="sm" aria-label="New event" onClick={newEvent}>
  <Plus className="size-4" strokeWidth={1.75} />
  Event
</Button>
```

- [ ] **Step 6: Pass props into the grids and render the modal**

Change the `<WeekGrid days={weekDayCells} />` usage to:

```tsx
<WeekGrid days={weekDayCells} onOpenEvent={openEvent} />
```

Change the `<MonthGrid days={monthDayCells} onOpenTask={openTask} />` usage to:

```tsx
<MonthGrid days={monthDayCells} onOpenTask={openTask} onOpenEvent={openEvent} />
```

Also update the week-view empty-state guard: events can exist with zero tasks, so the grid should render when either exists. Replace the `tasks?.length === 0 ? (<EmptyState … />) : (…)` condition with:

```tsx
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
```

Finally, render the modal at the end of the component, next to the existing `TaskDetailPanel` block:

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

- [ ] **Step 7: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS (all prior unresolved-prop errors now resolved).

- [ ] **Step 8: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 9: Commit**

```bash
git add src/components/calendar/CalendarPage.tsx
git commit -m "feat: wire events into CalendarPage (load, create, edit)"
```

---

## Task 10: Manual UAT

**Files:** none (verification only).

- [ ] **Step 1: Run the app**

Run: `npm run dev`
Open `/calendar`.

- [ ] **Step 2: Verify create**

Click **Event** in the header → modal opens → enter title "Standup", start 09:00, end 09:15, color blue → **Create**. Toast "Event created". Pill appears on today in week view at "9:00".

- [ ] **Step 3: Verify edit**

Click the pill → modal opens prefilled → change title to "Daily standup", color green → **Save**. Toast "Event saved". Pill updates (green, new title).

- [ ] **Step 4: Verify delete**

Click the pill → **Delete**. Toast "Event deleted". Pill disappears.

- [ ] **Step 5: Verify month view + all-day**

Switch to month view. Create an all-day event on a future day → it renders in that month cell. Confirm the "+N more" overflow still appears on a day with many items.

- [ ] **Step 6: Verify validation**

Open the editor, set end before start → **Create** → toast "End must be after start", modal stays open. Clear the title → toast "Title is required".

---

## Self-Review Notes

- **Spec coverage:** events table (Task 1) ✓; types (Task 2) ✓; CRUD hooks mirroring useSnippets (Task 4) ✓; event editor modal with title/all-day/start-end/color/location/description + delete (Task 6) ✓; EventPill (Task 5) ✓; events rendered on existing week + month grids (Tasks 7–9) ✓; recurrence/reminder columns present-but-dormant (Task 1) ✓. Recurrence expansion, day/time grid, and reminders are explicitly out of Phase 1 (later phases).
- **Type consistency:** `CalendarEvent`, `EventColor`, `EventInput`, `EVENT_COLORS`, `bucketEventsByDate`, `eventTimeLabel`, `useEvents/useCreateEvent/useUpdateEvent/useDeleteEvent`, and the `events` + `onOpenEvent` props are named identically across all tasks.
- **Known intentional intermediate failure:** typecheck fails after Tasks 7–8 and only passes after Task 9 wires `CalendarPage`. Called out in those tasks so the executor doesn't treat it as a defect.
- **No RTL:** UI is verified by typecheck + lint + build + manual UAT (Task 10); only the pure helpers get vitest unit tests (Task 3), matching repo conventions.
