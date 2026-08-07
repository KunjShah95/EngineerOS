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
