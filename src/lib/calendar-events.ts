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
