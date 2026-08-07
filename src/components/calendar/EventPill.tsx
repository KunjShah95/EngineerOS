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
  return (
    <button
      type="button"
      onClick={() => onOpen(event.id)}
      className={cn(
        "group flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs text-foreground transition-colors duration-150 hover:opacity-80"
      )}
      style={{ backgroundColor: `${hex}22`, borderLeft: `2px solid ${hex}` }}
    >
      <span className="shrink-0 text-[10px] font-medium text-faint">{eventTimeLabel(event)}</span>
      <span className="line-clamp-1 min-w-0">{event.title}</span>
    </button>
  );
}
