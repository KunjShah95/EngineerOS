# Calendar Events — Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.
>
> **Status note:** this plan was written **after** the implementation shipped in the calendar-events session (commits `cef0dc0`, `cbe8a85`, `189308a`, plus review fix `edd8206`). The embedded code matches the **reviewed final state of the repo**, not a hypothetical pre-implementation snapshot. Phase 4 (reminders) additions that later landed in the same files are marked `// Phase 4` inline; a Phase-3-only execution can omit those lines.

**Goal:** Add **recurrence** to calendar events, Google-Calendar style, using RRULE-lite: store the repeat rule on the event row (the `rrule_*` columns already exist, dormant, from the Phase 1 migration), **expand on read** into concrete instances for the visible range, and let users set the rule in the event editor's new **"Repeats"** UI. For v1, **edits apply to the whole series** (no per-instance overrides) — the scope agreed in the design spec.

**Architecture:** A pure, unit-tested expansion engine in `src/lib/recurrence.ts` (`expandEvent`) turns one event row into `EventInstance`s for `[fromISO, toISO]`. `useEvents` widens its range query to fetch any row that overlaps the window **or** is recurring (so a series whose first occurrence ended before the window still loads), then expands client-side and re-sorts by occurrence time. Instances share the series id and carry:
- `instanceDate` — local YYYY-MM-DD of the occurrence (day placement),
- `seriesStartsAt` / `seriesEndsAt` — the series' original start/end, which the editor prefills so saving an occurrence edits the series **without silently moving its base** (a naive "show the clicked occurrence" prefill would shift the whole series on save).

No instance table, no `rrule.js` dependency — matches the "RRULE-lite, expand-on-read" decision from the spec.

**Tech Stack:** Next.js (App Router), React Query, Supabase JS client, shadcn/ui (`Select`, `Input`, `Label`), `sonner`, `lucide-react`, vitest. No new dependencies.

---

## File Structure

**Create:**
- `src/lib/recurrence.ts` — `expandEvent`, `EventInstance`, `RecurrenceFreq`, `WEEKDAY_OPTIONS`, `MAX_INSTANCES`.
- `src/lib/recurrence.test.ts` — vitest tests for the engine.

**Modify:**
- `src/hooks/useEvents.ts` — fetch recurring rows, expand + sort in the query; carry `rrule_*` fields through create/update inputs.
- `src/components/calendar/EventEditorModal.tsx` — "Repeats" select + interval + weekly byday toggles + optional "Ends" date; serialize to `rrule_freq` / `rrule_interval` / `rrule_byday` / `rrule_until`.

**Delete:** none.

**Untouched by design:** `src/types/database.ts` already has `CalendarEvent.rrule_freq/interval/byday/until` and `remind_minutes` (Phase 1 migration created the columns; types were added then). The grids (`HourGrid`, `MonthGrid`, `EventPill`, `EventBlock`) render whatever `useEvents` returns — instances flow through unchanged.

## Design decisions

- **RRULE-lite scope:** daily / weekly / monthly × `interval`; weekly honors `byday` (RFC weekday codes `SU`…`SA`); inclusive `rrule_until`. Out of scope for v1: exceptions ("this event only"), yearly, nth-weekday-of-month ("second Tuesday"), and DST-safe wall-clock semantics (expansion uses local Date math).
- **Expand-on-read:** grids always query bounded ranges (week/month windows), so expansion is cheap; `MAX_INSTANCES = 366` hard-caps runaway series. No backfill, no instance table.
- **Local-time expansion:** instance times derive from the series' local time-of-day (`baseMinutes`) and per-occurrence local date; the DB stays UTC via `toISOString()`. All comparisons (`from`, `to`, `until`) are local-date strings/Date objects.
- **Weekly math is Monday-aligned:** the base week's Monday is `date - getDay() + 1`; each weekday index (Sun=0…Sat=6) maps to an offset `(dayIdx + 6) % 7` from that Monday. (The first implementation had a Sun-based offset off-by-one — Fridays became Saturdays; the shipped code pins the Monday-aligned version with tests.)
- **Monthly clamps to month length:** a 31st recurrence lands on Feb 28 / Apr 30, etc. (`daysInMonth`).
- **Series identity for editing:** every instance carries `seriesStartsAt`/`seriesEndsAt`; the editor prefills from them. This is the Google-Calendar "edit series" behavior and prevents the base-shift bug above. Non-recurring events get the same fields (equal to their own times — harmless fallback).
- **Query widening:** `.lte("starts_at", toISO T23:59:59).or("ends_at.gte.<from>T00:00:00,rrule_freq.not.is.null")` — the OR catches recurring series whose first occurrence already ended before `from` but still recurs into the window. PostgREST's `rrule_freq.not.is.null` is valid `.or()` syntax.
- **Reminders (Phase 4)** stay out of scope; `remind_minutes` remains dormant through this phase.
- **Known v1 limitation (accepted):** recurring reminders fire once at the series start (Phase 4 concern); per-occurrence editing ("this + future") is deferred.

---

## Task 1: Recurrence engine + tests (TDD)

**Files:**
- Create: `src/lib/recurrence.ts`
- Test: `src/lib/recurrence.test.ts`

All expansion logic is pure so it can be unit-tested: instance generation per frequency, interval, weekday filtering, until-clipping, range clipping, and the series-identity fields.

- [x] **Step 1: Write the failing test**

Create `src/lib/recurrence.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import type { CalendarEvent } from "@/types/database";
import { expandEvent } from "./recurrence";

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

describe("expandEvent — non-recurring", () => {
  it("returns the single instance when it intersects the range", () => {
    const e = evt({ starts_at: "2026-08-07T09:00:00", ends_at: "2026-08-07T10:00:00" });
    const out = expandEvent(e, "2026-08-03", "2026-08-09");
    expect(out).toHaveLength(1);
    expect(out[0].instanceDate).toBe("2026-08-07");
    // starts_at is stored as UTC ISO; convert the local expectation for TZ-agnosticism.
    expect(out[0].starts_at).toBe(new Date("2026-08-07T09:00:00").toISOString());
  });

  it("returns nothing when it misses the range", () => {
    const e = evt({ starts_at: "2026-08-07T09:00:00", ends_at: "2026-08-07T10:00:00" });
    expect(expandEvent(e, "2026-08-10", "2026-08-17")).toHaveLength(0);
  });
});

describe("expandEvent — daily", () => {
  const daily = evt({
    id: "d",
    rrule_freq: "daily",
    rrule_interval: 1,
    starts_at: "2026-08-07T09:05:00",
    ends_at: "2026-08-07T10:00:00",
  });

  it("expands every day in the range, preserving time of day and duration", () => {
    const out = expandEvent(daily, "2026-08-07", "2026-08-13");
    expect(out).toHaveLength(7);
    expect(out[0].instanceDate).toBe("2026-08-07");
    expect(out[6].instanceDate).toBe("2026-08-13");
    expect(out[3].starts_at).toBe(new Date("2026-08-10T09:05:00").toISOString());
    expect(out[3].ends_at).toBe(new Date("2026-08-10T10:00:00").toISOString());
  });

  it("honors the interval", () => {
    const everyOther = { ...daily, rrule_interval: 2 };
    const out = expandEvent(everyOther, "2026-08-07", "2026-08-13");
    expect(out.map((i) => i.instanceDate)).toEqual(["2026-08-07", "2026-08-09", "2026-08-11", "2026-08-13"]);
  });

  it("caps at until (inclusive)", () => {
    const capped = { ...daily, rrule_until: "2026-08-10" };
    const out = expandEvent(capped, "2026-08-07", "2026-08-20");
    expect(out.map((i) => i.instanceDate)).toEqual(["2026-08-07", "2026-08-08", "2026-08-09", "2026-08-10"]);
  });

  it("only returns instances inside the visible range (open-ended series)", () => {
    const out = expandEvent(daily, "2026-08-10", "2026-08-12");
    expect(out.map((i) => i.instanceDate)).toEqual(["2026-08-10", "2026-08-11", "2026-08-12"]);
  });
});

describe("expandEvent — weekly", () => {
  const base = evt({
    id: "w",
    rrule_freq: "weekly",
    rrule_interval: 1,
    starts_at: "2026-08-07T09:00:00", // Friday
    ends_at: "2026-08-07T09:30:00",
  });

  it("with byday, expands only the chosen weekdays", () => {
    const monWed = { ...base, rrule_byday: ["MO", "WE"] };
    // Series starts Fri Aug 7; MO/WE of that week already passed, so the first
    // occurrences land in the week of Aug 10: Mon Aug 10, Wed Aug 12.
    const out = expandEvent(monWed, "2026-08-10", "2026-08-16");
    expect(out.map((i) => i.instanceDate)).toEqual(["2026-08-10", "2026-08-12"]);
  });

  it("without byday, repeats on the base weekday", () => {
    const out = expandEvent(base, "2026-08-03", "2026-08-23"); // Fridays
    expect(out.map((i) => i.instanceDate)).toEqual([
      "2026-08-07", "2026-08-14", "2026-08-21",
    ]);
  });

  it("honors the interval in weeks", () => {
    const biweekly = { ...base, rrule_interval: 2 };
    const out = expandEvent(biweekly, "2026-08-03", "2026-08-23");
    expect(out.map((i) => i.instanceDate)).toEqual(["2026-08-07", "2026-08-21"]);
  });
});

describe("expandEvent — monthly", () => {
  const monthly = evt({
    id: "m",
    rrule_freq: "monthly",
    rrule_interval: 1,
    starts_at: "2026-01-31T10:00:00",
    ends_at: "2026-01-31T11:00:00",
  });

  it("keeps the day of month, clamped to month length", () => {
    const out = expandEvent(monthly, "2026-01-01", "2026-04-30");
    expect(out.map((i) => i.instanceDate)).toEqual([
      "2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30",
    ]);
  });
});

describe("expandEvent — series identity", () => {
  it("carries the series' original start/end on every instance", () => {
    const daily = evt({
      rrule_freq: "daily",
      rrule_interval: 1,
      starts_at: "2026-08-07T09:05:00",
      ends_at: "2026-08-07T10:00:00",
    });
    const out = expandEvent(daily, "2026-08-07", "2026-08-09");
    expect(out).toHaveLength(3);
    for (const inst of out) {
      // Occurrence times advance per day…
      expect(inst.instanceDate).toMatch(/^2026-08-0[789]$/);
      // …but the series base is preserved so the editor can edit the series.
      expect(inst.seriesStartsAt).toBe("2026-08-07T09:05:00");
      expect(inst.seriesEndsAt).toBe("2026-08-07T10:00:00");
    }
  });

  it("non-recurring instances mirror their own times", () => {
    const e = evt({ starts_at: "2026-08-07T09:00:00", ends_at: "2026-08-07T10:00:00" });
    const out = expandEvent(e, "2026-08-03", "2026-08-09");
    expect(out[0].seriesStartsAt).toBe("2026-08-07T09:00:00");
    expect(out[0].seriesEndsAt).toBe("2026-08-07T10:00:00");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/recurrence.test.ts` — fails on module-not-found for `./recurrence` (or on a stub).

- [x] **Step 3: Implement the engine**

Create `src/lib/recurrence.ts`:

```ts
import { toISODate } from "@/lib/calendar";
import type { CalendarEvent } from "@/types/database";

/** Safety cap on instances generated per event (grids always query bounded ranges). */
export const MAX_INSTANCES = 366;

export type RecurrenceFreq = "daily" | "weekly" | "monthly";

/** One concrete occurrence of an event series (or the event itself). */
export interface EventInstance extends CalendarEvent {
  /** Local YYYY-MM-DD of this occurrence. */
  instanceDate: string;
  /**
   * The series' original start/end (its first occurrence). Editing an
   * occurrence edits the whole series, so the editor prefills from these
   * rather than the occurrence's own starts_at — otherwise saving would
   * silently move the recurrence base. Equal to starts_at/ends_at for
   * non-recurring events (harmless fallback).
   */
  seriesStartsAt: string;
  seriesEndsAt: string;
}

/** Weekday codes shown in the editor, in JS `getDay()` order (Sun=0 … Sat=6). */
export const WEEKDAY_OPTIONS: { code: string; label: string }[] = [
  { code: "SU", label: "S" },
  { code: "MO", label: "M" },
  { code: "TU", label: "T" },
  { code: "WE", label: "W" },
  { code: "TH", label: "T" },
  { code: "FR", label: "F" },
  { code: "SA", label: "S" },
];

const WEEKDAY_INDEX: Record<string, number> = {
  SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
};

function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}

/** Local midnight of a date. */
function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Expand an event row into concrete instances that fall within
 * [fromISO, toISO] (both YYYY-MM-DD, local). Non-recurring events return a
 * single instance when (and only when) they intersect the range.
 *
 * Rules supported: daily / weekly / monthly, `interval`, weekly `byday`,
 * inclusive `rrule_until`. Every instance preserves the series' time of day
 * and duration. Expansion is hard-capped at MAX_INSTANCES.
 */
export function expandEvent(
  event: CalendarEvent,
  fromISO: string,
  toISO: string
): EventInstance[] {
  const from = new Date(`${fromISO}T00:00:00`);
  const to = new Date(`${toISO}T23:59:59.999`);
  const baseStart = new Date(event.starts_at);
  const baseDate = startOfLocalDay(baseStart);
  const baseMinutes = baseStart.getHours() * 60 + baseStart.getMinutes();
  const durationMs = new Date(event.ends_at).getTime() - baseStart.getTime();

  const instanceAt = (date: Date): EventInstance => {
    const start = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      Math.floor(baseMinutes / 60),
      baseMinutes % 60
    );
    return {
      ...event,
      starts_at: start.toISOString(),
      ends_at: new Date(start.getTime() + durationMs).toISOString(),
      instanceDate: toISODate(date),
      seriesStartsAt: event.starts_at,
      seriesEndsAt: event.ends_at,
    };
  };

  const freq = event.rrule_freq;
  if (!freq) {
    if (new Date(event.ends_at) < from || baseStart > to) return [];
    return [instanceAt(baseDate)];
  }

  const interval = Math.max(1, event.rrule_interval ?? 1);
  const byday = event.rrule_byday && event.rrule_byday.length > 0 ? event.rrule_byday : null;
  const until = event.rrule_until ? new Date(`${event.rrule_until}T23:59:59.999`) : null;

  // Generate candidate occurrence dates (monotonic per freq).
  const candidates: Date[] = [];
  if (freq === "daily") {
    for (let i = 0; i < MAX_INSTANCES; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + i * interval);
      candidates.push(d);
    }
  } else if (freq === "weekly") {
    const mondayOfBaseWeek = startOfLocalDay(
      new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() - baseDate.getDay() + 1)
    );
    const daysToUse = byday
      ? byday.map((code) => WEEKDAY_INDEX[code]).filter((i) => i !== undefined)
      : [baseDate.getDay()];
    // dayIdx is Sun=0 … Sat=6; offset from a Monday-aligned week start is (dayIdx + 6) % 7.
    const offsets = daysToUse.map((dayIdx) => (dayIdx + 6) % 7);
    for (let w = 0; w * interval < MAX_INSTANCES; w++) {
      const monday = new Date(mondayOfBaseWeek);
      monday.setDate(monday.getDate() + w * interval * 7);
      for (const offset of offsets) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + offset);
        candidates.push(d);
      }
    }
  } else {
    // monthly — same day of month, clamped to the month's length
    for (let i = 0; i < MAX_INSTANCES; i++) {
      const target = new Date(baseDate.getFullYear(), baseDate.getMonth() + i * interval, 1);
      const day = Math.min(baseDate.getDate(), daysInMonth(target.getFullYear(), target.getMonth()));
      candidates.push(new Date(target.getFullYear(), target.getMonth(), day));
    }
  }

  const instances: EventInstance[] = [];
  for (const d of candidates) {
    if (d < baseDate) continue;
    if (until && d > until) break;
    if (d > to) break; // candidates are monotonic
    if (d < from) continue;
    instances.push(instanceAt(d));
    if (instances.length >= MAX_INSTANCES) break;
  }
  return instances;
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/recurrence.test.ts` — 12 tests pass.

---

## Task 2: Expand-on-read in useEvents

**File:** Modify `src/hooks/useEvents.ts`

The range query widens to include recurring rows and expands them into instances. The create/update mutations gain the `rrule_*` fields. (The `remind_minutes` input field and `syncEventReminder` below are **Phase 4** — omit for a Phase-3-only execution.)

- [x] **Step 1: Rewrite the hook**

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import { expandEvent } from "@/lib/recurrence";
import type { CalendarEvent } from "@/types/database";

/**
 * Non-deleted events overlapping [fromISO, toISO] (both YYYY-MM-DD).
 * Recurring rows are expanded client-side into concrete instances for the
 * range; instances share the series id and carry an `instanceDate`.
 */
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
        .or(`ends_at.gte.${fromISO}T00:00:00,rrule_freq.not.is.null`)
        .order("starts_at", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as CalendarEvent[];
      return rows
        .flatMap((event) => expandEvent(event, fromISO, toISO))
        // Instances inherit the series' ordering; re-sort by occurrence time
        // so pills within a day render chronologically.
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    },
    enabled: Boolean(workspaceId),
  });
}

export type EventInput = Partial<
  Pick<
    CalendarEvent,
    | "title"
    | "description"
    | "location"
    | "color"
    | "all_day"
    | "starts_at"
    | "ends_at"
    | "rrule_freq"
    | "rrule_interval"
    | "rrule_byday"
    | "rrule_until"
    // Phase 4: | "remind_minutes"
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
          rrule_freq: input.rrule_freq ?? null,
          rrule_interval: input.rrule_interval ?? null,
          rrule_byday: input.rrule_byday ?? null,
          rrule_until: input.rrule_until ?? null,
          // Phase 4: remind_minutes: input.remind_minutes ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      const event = data as CalendarEvent;
      // Phase 4: await syncEventReminder(supabase, workspaceId!, event);
      return event;
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
      const event = data as CalendarEvent;
      // Phase 4: reminder resync on remind_minutes/starts_at/title changes.
      return event;
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
      // Phase 4: clear pending reminder jobs for the event here.
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

> The repo's current `useEvents.ts` also contains `remind_minutes` wiring and `syncEventReminder` (Phase 4) — see the Phase 3+4 plan for the full file. The snippet above is the Phase 3 scope with the Phase 4 lines marked.

- [x] **Step 2: Verify**

Run: `npm run typecheck` — clean (CalendarPage/modal already consume the expanded shape).

---

## Task 3: "Repeats" UI in the event editor

**File:** Modify `src/components/calendar/EventEditorModal.tsx`

Add the Repeats select (never/daily/weekly/monthly), an interval input, weekly weekday toggles, and an optional "Ends" date; serialize into the payload. Also: prefill from the **series base** when editing an occurrence (see design decisions). The Reminder block below is **Phase 4** — omit for a Phase-3-only execution.

- [x] **Step 1: Add the recurrence state + validation**

Import the weekday options:

```ts
import { WEEKDAY_OPTIONS, type EventInstance, type RecurrenceFreq } from "@/lib/recurrence";
```

Add the `Repeats` type near the other consts, and the state with the other fields:

```ts
type Repeats = "never" | RecurrenceFreq;
```

```ts
  // Recurrence (Phase 3)
  const [repeats, setRepeats] = useState<Repeats>(event?.rrule_freq ?? "never");
  const [intervalN, setIntervalN] = useState(event?.rrule_interval ?? 1);
  const [byday, setByday] = useState<string[]>(event?.rrule_byday ?? []);
  const [until, setUntil] = useState(event?.rrule_until ?? "");
```

Prefill the editor from the series base (not the clicked occurrence) — otherwise saving an occurrence would move the whole series:

```ts
  // Editing an occurrence edits the whole series, so prefill from the series'
  // original start/end (expansion keeps them on instances). For non-recurring
  // events these equal starts_at/ends_at.
  const defaultStart = event
    ? toLocalInput(event.seriesStartsAt ?? event.starts_at)
    : (initialStart ?? `${today}T09:00`);
  const defaultEnd = event
    ? toLocalInput(event.seriesEndsAt ?? event.ends_at)
    : (initialEnd ?? (initialStart ? addMinutesLocal(initialStart, 30) : `${today}T10:00`));
```

Validation + payload serialization in `submit()`:

```ts
    if (repeats === "weekly" && byday.length === 0) {
      toast.error("Pick at least one repeat day");
      return;
    }
```

```ts
      rrule_freq: repeats === "never" ? null : repeats,
      rrule_interval: repeats === "never" ? null : Math.max(1, Math.floor(intervalN) || 1),
      rrule_byday: repeats === "weekly" ? byday : null,
      rrule_until: until || null,
```

- [x] **Step 2: Add the Repeats UI (after the start/end grid, before Location)**

```tsx
          {/* Repeats */}
          <div className="space-y-1.5">
            <Label>Repeats</Label>
            <Select value={repeats} onValueChange={(v) => setRepeats(v as Repeats)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="never">Never</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {repeats !== "never" && (
            <>
              <div className="flex items-end gap-2">
                <div className="w-24 space-y-1.5">
                  <Label htmlFor="event-interval">Every</Label>
                  <Input
                    id="event-interval"
                    type="number"
                    min={1}
                    max={99}
                    value={intervalN}
                    onChange={(e) => setIntervalN(Number(e.target.value))}
                  />
                </div>
                <span className="pb-2 text-xs text-faint">
                  {repeats === "weekly" ? "week(s)" : repeats === "monthly" ? "month(s)" : "day(s)"}
                </span>
              </div>

              {repeats === "weekly" && (
                <div className="flex gap-1.5">
                  {WEEKDAY_OPTIONS.map((d) => {
                    const active = byday.includes(d.code);
                    return (
                      <button
                        key={d.code}
                        type="button"
                        onClick={() =>
                          setByday(active ? byday.filter((c) => c !== d.code) : [...byday, d.code])
                        }
                        aria-pressed={active}
                        className={cn(
                          "size-7 rounded-full text-xs font-medium transition-colors",
                          active
                            ? "bg-accent text-accent-foreground"
                            : "bg-surface-hover text-secondary hover:text-foreground"
                        )}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="event-until">Ends (optional)</Label>
                <Input
                  id="event-until"
                  type="date"
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                />
              </div>
            </>
          )}
```

The prop type widens so instances (which carry `seriesStartsAt`/`seriesEndsAt`) are accepted:

```ts
  event: (CalendarEvent & Partial<EventInstance>) | null;
```

- [x] **Step 3: Verify**

Run: `npm run typecheck` — clean. (The full modal file, including the Phase 4 Reminder block, is in the repo; the Phase 3+4 plan embeds it complete.)

---

## Task 4: Full validation

- [x] **Step 1: Run the full test suite**

Run: `npx vitest run` — 127 tests pass (12 new recurrence tests among them).

- [x] **Step 2: Typecheck + lint + build**

```bash
npm run typecheck
npx eslint src/lib/recurrence.ts src/lib/recurrence.test.ts src/hooks/useEvents.ts src/components/calendar/EventEditorModal.tsx
npm run build
```

All clean.

---

## Task 5: Manual UAT

Run: `npm run dev`. Open `/calendar` (needs the local Supabase stack + the Phase 1 `events` migration applied).

- [ ] **Step 1: Create a weekly series**

Create an event → set **Repeats: Weekly** with Mon/Wed → Save → switch to month view: instances appear on the chosen weekdays with the correct times.

- [ ] **Step 2: Edit the series from an occurrence**

Click a later occurrence → the editor prefills the **series** start/end (not that occurrence). Change the title → Save → all occurrences update; the base date did not shift.

- [ ] **Step 3: Interval + until**

Set **Every 2 weeks** → occurrences skip alternate weeks. Set an **Ends** date → occurrences stop after it (inclusive).

- [ ] **Step 4: Monthly clamping**

Create a monthly event on the 31st → February shows the 28th, March the 31st.

- [ ] **Step 5: Back to one-off**

Edit a series → set **Repeats: Never** → it becomes a single event; other instances disappear.

- [ ] **Step 6: Validation**

Weekly with zero days picked → toast "Pick at least one repeat day".

---

## Self-Review Notes

- **Spec coverage:** RRULE-lite fields ✓ (Task 1 engine + Task 3 UI, columns pre-created in Phase 1); expand-on-read in `useEvents` ✓ (Task 2); "Repeats" UI ✓ (Task 3); whole-series edits ✓ (editor prefills `seriesStartsAt`/`seriesEndsAt`); no instance table / no rrule.js ✓.
- **Consistency:** pure helpers + vitest matches the repo's no-RTL convention (same as Phase 1 `calendar-events.ts` and Phase 2 `calendar-grid.ts`); React Query patterns (`invalidateQueries` prefix keys) unchanged; shadcn `Select`/`Input`/`Label` and `sonner` toasts reused.
- **Review fixes baked in:** Monday-aligned weekly math (Sun-offset off-by-one bug); series-identity fields (`seriesStartsAt`/`seriesEndsAt`) prevent the base-shift bug — the reviewer's alternate suggestion (open the clicked instance) would have moved the series base on save; instances re-sorted by occurrence time after expansion; the engine hard-caps at `MAX_INSTANCES`.
- **Known intentional intermediate failure:** none — Tasks 1–3 each leave the tree typechecking.
- **Time-zone handling:** expansion is local-time based (same convention as bucketing); `starts_at`/`ends_at` stay UTC in the DB. DST shifts in weekly wall-clock times are an accepted v1 caveat of local-Date math.
- **Edge cases covered (tested):** non-recurring in/out of range; daily interval; until inclusive; range clipping; weekly byday on the base week (days already passed are skipped); biweekly; monthly clamp to month length; series-identity fields on recurring and non-recurring instances.
- **Known v1 limitations:** edits always apply to the whole series (no "this event only"); no yearly frequency; recurring reminders fire once at the series start (Phase 4); expansion is read-time so the instance table/backfill remain unnecessary until per-instance overrides land.
