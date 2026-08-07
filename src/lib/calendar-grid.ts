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
