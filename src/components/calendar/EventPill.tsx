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
  const label = `${event.title} · ${eventTimeLabel(event)}`;
  return (
    <button
      type="button"
      onClick={() => onOpen(event.id)}
      title={label}
      aria-label={label}
      className={cn(
        "group flex h-[22px] w-full min-w-0 items-center gap-1.5 rounded-[4px] px-1.5 text-left text-[11px] leading-none text-foreground transition-[filter] duration-150 hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      )}
      style={{ backgroundColor: `${hex}2e`, boxShadow: `inset 3px 0 0 0 ${hex}` }}
    >
      {!event.all_day && (
        <span className="figure-mono shrink-0 text-[10px] text-secondary">
          {eventTimeLabel(event)}
        </span>
      )}
      <span className="line-clamp-1 min-w-0 font-medium">{event.title}</span>
    </button>
  );
}