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
