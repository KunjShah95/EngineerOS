import { toISODate } from "@/lib/calendar";
import type { CalendarEvent } from "@/types/database";

/** Safety cap on instances generated per event (grids always query bounded ranges). */
export const MAX_INSTANCES = 366;

export type RecurrenceFreq = "daily" | "weekly" | "monthly";

/** One concrete occurrence of an event series (or the event itself). */
export interface EventInstance extends CalendarEvent {
  /** Local YYYY-MM-DD of this occurrence. */
  instanceDate: string;
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
