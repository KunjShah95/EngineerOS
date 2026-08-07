"use client";

import { useState, type PointerEvent } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { EVENT_COLORS, eventTimeLabel } from "@/lib/calendar-events";
import {
  MIN_BLOCK_HEIGHT,
  MINUTE_SNAP,
  resizeEventOnDay,
  snapMinutes,
  type TimedLayout,
} from "@/lib/calendar-grid";
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
  const hex = EVENT_COLORS[event.color];
  const width = `calc(${100 / layout.columns}% - 2px)`;
  const left = `calc(${(layout.column / layout.columns) * 100}% + 1px)`;

  // ---- drag-to-resize ----
  // Native pointer events on the edge handles (same pattern as the grid's
  // click/drag-select create). Handles stopPropagation, so dnd-kit's move-drag
  // never starts and the column's create-select never fires. The block shows a
  // live preview while dragging; pointerup commits through `onResize` (which
  // HourGrid routes to the same persist path as drag-to-move).
  const [resize, setResize] = useState<{
    edge: "start" | "end";
    minutes: number;
    /** Pointer Y at drag start — delta is relative, so no rect math needed. */
    startY: number;
    baseStart: number;
    baseEnd: number;
  } | null>(null);

  const startMin = (layout.topPx / hourHeight) * 60;
  const endMin = startMin + (layout.heightPx / hourHeight) * 60;

  const beginResize = (edge: "start" | "end") => (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation(); // don't start the move drag / column create-select
    setResize({
      edge,
      minutes: edge === "start" ? startMin : endMin,
      startY: e.clientY,
      baseStart: startMin,
      baseEnd: endMin,
    });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const moveResize = (e: PointerEvent<HTMLDivElement>) => {
    if (!resize) return;
    const { edge, startY, baseStart, baseEnd } = resize;
    const delta = ((e.clientY - startY) / hourHeight) * 60;
    // Compute from the drag base, not the last snapped value — accumulating
    // from snapped minutes makes the preview jump a whole snap step when the
    // pointer reverses direction (e.g. 9:26 → snap 9:30, then 9:25 → 9:00).
    const base = edge === "start" ? baseStart : baseEnd;
    let next = snapMinutes(base + delta);
    // Keep the visible slice ≥ MINUTE_SNAP so the preview never collapses.
    if (edge === "start") next = Math.min(next, baseEnd - MINUTE_SNAP);
    else next = Math.max(next, baseStart + MINUTE_SNAP);
    setResize({ ...resize, minutes: next });
  };

  const endResize = () => {
    if (!resize) return;
    const { edge, minutes, baseStart, baseEnd } = resize;
    setResize(null);
    // A bare click, or a drag that returned to the original bucket, is a no-op.
    if (minutes === (edge === "start" ? baseStart : baseEnd)) return;
    const resized = resizeEventOnDay(event, dayIso, edge, minutes);
    if (!resized) return; // below min duration — treat as a no-op
    if (resized.starts_at === event.starts_at && resized.ends_at === event.ends_at) return;
    onResize(event.id, resized.starts_at, resized.ends_at);
  };

  const topPx =
    resize && resize.edge === "start" ? (resize.minutes / 60) * hourHeight : layout.topPx;
  const heightPx =
    resize && resize.edge === "end"
      ? Math.max(MIN_BLOCK_HEIGHT, ((resize.minutes - startMin) / 60) * hourHeight)
      : resize && resize.edge === "start"
        ? Math.max(MIN_BLOCK_HEIGHT, ((endMin - resize.minutes) / 60) * hourHeight)
        : layout.heightPx;

  // Live time label during a resize (falls back to the stored times when the
  // drag produced an invalid slice — the block is at min height anyway).
  const resized = resize ? resizeEventOnDay(event, dayIso, resize.edge, resize.minutes) : null;
  const labelEvent = resized ? { ...event, starts_at: resized.starts_at, ends_at: resized.ends_at } : event;

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
