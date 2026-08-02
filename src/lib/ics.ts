// Minimal iCalendar (RFC 5545) generator for calendar sync export.

function icsEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** Fold lines longer than 75 octets per RFC 5545 §3.1. */
function fold(value: string): string {
  const limit = 75;
  if (value.length <= limit) return value;
  const lines: string[] = [];
  let rest = value;
  while (rest.length > limit) {
    lines.push(rest.slice(0, limit));
    rest = rest.slice(limit);
  }
  lines.push(rest);
  return lines.join("\r\n ");
}

/** "20260802T090000Z" or date-only "20260802". */
function formatDate(d: Date, allDay: boolean): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = d.getUTCFullYear();
  const mo = pad(d.getUTCMonth() + 1);
  const day = pad(d.getUTCDate());
  if (allDay) return `${y}${mo}${day}`;
  return `${y}${mo}${day}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
}

export interface IcsEvent {
  uid: string;
  title: string;
  description?: string;
  url?: string;
  /** ISO date string, e.g. "2026-08-02". */
  date: string;
  allDay?: boolean;
}

export function buildIcs(events: IcsEvent[]): string {
  const now = new Date();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EngineerOS//Tasks//EN",
    "CALSCALE:GREGORIAN",
  ];

  for (const ev of events) {
    const date = new Date(`${ev.date}T00:00:00Z`);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${ev.uid}@engineeros`,
      `DTSTAMP:${formatDate(now, false)}`,
      `DTSTART;VALUE=DATE:${formatDate(date, ev.allDay ?? true)}`,
      fold(`SUMMARY:${icsEscape(ev.title)}`)
    );
    if (ev.description) lines.push(fold(`DESCRIPTION:${icsEscape(ev.description)}`));
    if (ev.url) lines.push(fold(`URL:${ev.url}`));
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
