"use client";

import { format } from "date-fns";

import { useGridResize } from "@/hooks/useGridResize";
import { taskTimedRange, type TimedLayout } from "@/lib/calendar-grid";
import { priorityColor } from "@/lib/task-meta";
import { cn } from "@/lib/utils";
import type { TaskWithProject } from "@/types/database";

/** "9:00am" for an instant, rendered in local time. */
function clock(iso: string): string {
  return format(new Date(iso), "h:mma");
}

export function TaskBlock({
  task,
  layout,
  hourHeight,
  dayIso,
  onOpen,
  onResize,
}: {
  task: TaskWithProject;
  layout: TimedLayout;
  hourHeight: number;
  /** Local YYYY-MM-DD of the day column this block renders in. */
  dayIso: string;
  onOpen: (id: string) => void;
  /** Persist a resize — new start/end with the opposite boundary fixed. */
  onResize: (id: string, startsAt: string, endsAt: string) => void;
}) {
  // HourGrid only renders timed tasks here, so the range is always present;
  // the hook still runs first (rules of hooks), then we bail if it vanished.
  const range = taskTimedRange(task);
  const { beginResize, moveResize, endResize, topPx, heightPx, resized } = useGridResize({
    id: task.id,
    startsAt: range?.starts_at ?? "",
    endsAt: range?.ends_at ?? "",
    dayIso,
    layout,
    hourHeight,
    onResize,
  });
  if (!range) return null;
  const width = `calc(${100 / layout.columns}% - 2px)`;
  const left = `calc(${(layout.column / layout.columns) * 100}% + 1px)`;

  // Live time label during a resize; falls back to the stored range.
  const labelStart = resized?.starts_at ?? range.starts_at;
  const labelEnd = resized?.ends_at ?? range.ends_at;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={task.title}
      title={task.title}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(task.id);
      }}
      onClick={() => onOpen(task.id)}
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(
        "group absolute z-10 touch-none select-none overflow-hidden rounded-md border border-border-subtle bg-elevated px-1.5 py-0.5 text-left text-[11px] leading-tight text-foreground transition-colors duration-150 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        task.status === "done" && "opacity-50"
      )}
      style={{ top: topPx, height: heightPx, width, left }}
    >
      <p className={cn("line-clamp-1 font-medium", task.status === "done" && "line-through")}>
        <span
          className="mr-1 inline-block size-1.5 rounded-full align-middle"
          style={{ backgroundColor: priorityColor(task.priority) }}
          aria-hidden
        />
        {task.title}
      </p>
      {heightPx >= hourHeight * 0.55 && (
        <p className="line-clamp-1 text-faint">
          {clock(labelStart)} – {clock(labelEnd)}
        </p>
      )}

      {/* Resize handles — pointer-only affordances (the block's own click opens
          the task panel; handles suppress it so a resize never opens it). */}
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
