"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { EVENT_COLORS, eventTimeLabel } from "@/lib/calendar-events";
import { cn } from "@/lib/utils";
import type { TimedLayout } from "@/lib/calendar-grid";
import type { CalendarEvent } from "@/types/database";

export function EventBlock({
  event,
  layout,
  hourHeight,
  onOpen,
}: {
  event: CalendarEvent;
  layout: TimedLayout;
  hourHeight: number;
  onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `event:${event.id}`,
    data: { event },
  });
  const hex = EVENT_COLORS[event.color];
  const width = `calc(${100 / layout.columns}% - 2px)`;
  const left = `calc(${(layout.column / layout.columns) * 100}% + 1px)`;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      aria-label={event.title}
      title={event.title}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(event.id);
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(
        "group absolute z-10 cursor-grab touch-none select-none overflow-hidden rounded-md px-1.5 py-0.5 text-left text-[11px] leading-tight text-foreground transition-shadow duration-150 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 active:cursor-grabbing",
        isDragging && "z-20 opacity-70 shadow-lg"
      )}
      style={{
        top: layout.topPx,
        height: layout.heightPx,
        width,
        left,
        backgroundColor: `${hex}26`,
        borderLeft: `3px solid ${hex}`,
        transform: CSS.Transform.toString(transform),
      }}
    >
      <p className="line-clamp-1 font-medium">{event.title}</p>
      {layout.heightPx >= hourHeight * 0.55 && (
        <p className="line-clamp-1 text-faint">
          {eventTimeLabel(event)}
          {layout.clippedStart ? " ◄" : ""}
          {layout.clippedEnd ? " ►" : ""}
        </p>
      )}
    </div>
  );
}
