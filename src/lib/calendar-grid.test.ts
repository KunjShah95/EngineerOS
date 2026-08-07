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
