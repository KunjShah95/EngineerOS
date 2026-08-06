export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  d.setDate(d.getDate() - day);
  return d;
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** 7 ISO dates (Mon–Sun) starting at weekStart. */
export function buildWeek(weekStart: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => toISODate(addDays(weekStart, i)));
}

const WEEKDAY_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
/** e.g. "Monday"; expects a Monday-aligned date. */
export function weekdayName(date: Date): string {
  return WEEKDAY_LONG[(date.getDay() + 6) % 7];
}

/** "Aug 2 – Aug 8, 2026" for a Monday-aligned week. */
export function formatWeekRange(weekStart: Date): string {
  const start = toISODate(weekStart);
  const end = addDays(weekStart, 6);
  const startLabel = formatShort(start);
  const endLabel = formatShort(toISODate(end), true);
  return `${startLabel} – ${endLabel}`;
}

function formatShort(iso: string, includeYear = false): string {
  const [y, m, d] = iso.split("-").map(Number);
  const label = new Date(y, m - 1, d).getDate();
  const month = MONTHS[m - 1];
  const year = includeYear ? `, ${y}` : "";
  return `${month} ${label}${year}`;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** First day (Sunday) of the week containing `date` (Sunday-aligned for month grid). */
export function startOfWeekSunday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

/** All days in the 6-week grid for a given month (includes padding from prev/next months). */
export function buildMonthGrid(year: number, month: number): { date: Date; iso: string; isCurrentMonth: boolean }[] {
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = startOfWeekSunday(firstOfMonth);
  return Array.from({ length: 42 }, (_, i) => {
    const date = addDays(gridStart, i);
    return {
      date,
      iso: toISODate(date),
      isCurrentMonth: date.getMonth() === month,
    };
  });
}

export function formatMonthYear(year: number, month: number): string {
  return `${MONTHS[month]} ${year}`;
}