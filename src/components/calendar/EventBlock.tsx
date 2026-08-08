"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useGridResize } from "@/hooks/useGridResize";
import { EVENT_COLORS, eventTimeLabel } from "@/lib/calendar-events";
import type { TimedLayout } from "@/lib/calendar-grid";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/types/database";

export function EventBlock({
  event,
  layout,
  hourHeight,
  dayIso,
  onOpen,
  onResize,
}: {
  event: CalendarEvent;
  layout: TimedLayout;
  hourHeight: number;
  /** Local YYYY-MM-DD of the day column this block renders in. */
  dayIso: string;
  onOpen: (id: string) => void;
  /** Persist a resize — new start/end with the opposite boundary fixed. */
  onResize: (id: string, startsAt: string, endsAt: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `event:${event.id}`,
    data: { event },
  });
  const { beginResize, moveResize, endResize, topPx, heightPx, resized } = useGridResize({
    id: event.id,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    dayIso,
    layout,
    hourHeight,
    onResize,
  });
  const hex = EVENT_COLORS[event.color];
  const width = `calc(${100 / layout.columns}% - 2px)`;
  const left = `calc(${(layout.column / layout.columns) * 100}% + 1px)`;

  // Live time label during a resize (falls back to the stored times when the
  // drag produced an invalid slice — the block is at min height anyway).
  const labelEvent = resized
    ? { ...event, starts_at: resized.starts_at, ends_at: resized.ends_at }
    : event;

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
      onClick={() => onOpen(event.id)}
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(
        "group absolute z-10 cursor-grab touch-none select-none overflow-hidden rounded-md px-1.5 py-0.5 text-left text-[11px] leading-tight text-foreground transition-shadow duration-150 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 active:cursor-grabbing",
        isDragging && "z-20 opacity-70 shadow-lg"
      )}
      style={{
        top: topPx,
        height: heightPx,
        width,
        left,
        backgroundColor: `${hex}26`,
        borderLeft: `3px solid ${hex}`,
        transform: CSS.Transform.toString(transform),
      }}
    >
      <p className="line-clamp-1 font-medium">{event.title}</p>
      {heightPx >= hourHeight * 0.55 && (
        <p className="line-clamp-1 text-faint">
          {eventTimeLabel(labelEvent)}
          {layout.clippedStart ? " ◄" : ""}
          {layout.clippedEnd ? " ►" : ""}
        </p>
      )}

      {/* Resize handles — pointer-only affordances (the block's own click opens
          the editor; handles suppress it so a resize never opens the modal). */}
      <div
        aria-hidden="true"
        onPointerDown={beginResize("start")}
        onPointerMove={moveResize}
        onPointerUp={endResize}
        onPointerCancel={endResize}
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-x-0 top-0 h-1.5 cursor-ns-resize touch-none"
        title="Resize start"
      />
      <div
        aria-hidden="true"
        onPointerDown={beginResize("end")}
        onPointerMove={moveResize}
        onPointerUp={endResize}
        onPointerCancel={endResize}
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize touch-none"
        title="Resize end"
      />
    </div>
  );
}
