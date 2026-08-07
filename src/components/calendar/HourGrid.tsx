"use client";

import * as React from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from "@dnd-kit/core";
import { format } from "date-fns";

import { EventBlock } from "@/components/calendar/EventBlock";
import { EventPill } from "@/components/calendar/EventPill";
import { TaskPill } from "@/components/calendar/TaskPill";
import { toISODate } from "@/lib/calendar";
import {
  DAY_MINUTES,
  HOUR_HEIGHT,
  MINUTE_SNAP,
  layoutEventColumns,
  minutesSinceMidnight,
  snapMinutes,
  type TimedLayout,
} from "@/lib/calendar-grid";
import { cn } from "@/lib/utils";
import type { CalendarEvent, TaskWithProject } from "@/types/database";

export interface HourGridDay {
  iso: string;
  date: Date;
  tasks: TaskWithProject[];
  events: CalendarEvent[];
}

interface HourGridProps {
  days: HourGridDay[];
  onOpenEvent: (id: string) => void;
  /** Called with a snapped range when an empty slot is clicked or dragged. */
  onCreateEvent: (iso: string, startMinutes: number, endMinutes: number) => void;
  /** Persist a move (duration already preserved). */
  onMoveEvent: (id: string, startsAt: string, endsAt: string) => void;
  hourHeight?: number;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function HourGrid({
  days,
  onOpenEvent,
  onCreateEvent,
  onMoveEvent,
  hourHeight = HOUR_HEIGHT,
}: HourGridProps) {
  const todayISO = toISODate(new Date());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  // Pointer position decides the drop column (same rationale as KanbanBoard:
  // rect intersection can pick the wrong tall column and oscillate).
  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const pointerCollisions = pointerWithin(args);
    return pointerCollisions.length > 0 ? pointerCollisions : closestCorners(args);
  }, []);

  // ---- drag-to-move ----
  const draggingRef = useRef(false);

  // ---- click / drag-select-to-create ----
  const [selection, setSelection] = useState<{
    dayIso: string;
    startMin: number;
    endMin: number;
  } | null>(null);
  const selectRef = useRef<{ dayIso: string; startMin: number; endMin: number } | null>(null);

  // Per-day side-by-side layout for timed events.
  const layoutsByDay = useMemo(() => {
    const map = new Map<string, Map<string, TimedLayout>>();
    for (const day of days) {
      map.set(day.iso, layoutEventColumns(day.iso, day.events.filter((e) => !e.all_day), hourHeight));
    }
    return map;
  }, [days, hourHeight]);

  const handleSelectStart = (dayIso: string) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || e.target !== e.currentTarget) return; // empty area only
    const rect = e.currentTarget.getBoundingClientRect();
    const startMin = snapMinutes(((e.clientY - rect.top) / hourHeight) * 60);
    selectRef.current = { dayIso, startMin, endMin: startMin };
    setSelection({ dayIso, startMin, endMin: startMin });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleSelectMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const sel = selectRef.current;
    if (!sel) return;
    const rect = e.currentTarget.getBoundingClientRect();
    sel.endMin = snapMinutes(((e.clientY - rect.top) / hourHeight) * 60);
    setSelection({ dayIso: sel.dayIso, startMin: sel.startMin, endMin: sel.endMin });
  };

  const handleSelectEnd = () => {
    const sel = selectRef.current;
    if (!sel) return;
    selectRef.current = null;
    setSelection(null);
    const start = Math.min(sel.startMin, sel.endMin);
    let end = Math.max(sel.startMin, sel.endMin);
    if (end - start < MINUTE_SNAP) end = start + 60; // a click creates a 1h event
    if (end > DAY_MINUTES) end = DAY_MINUTES;
    onCreateEvent(sel.dayIso, start, end);
  };

  // A click that lands right after a drag must not open the editor. The
  // browser dispatches `click` synchronously after `pointerup` (same task),
  // so the flag is still set when it fires; the timeout clears it after.
  const guardedOpen = (id: string) => {
    if (draggingRef.current) return;
    onOpenEvent(id);
  };

  const handleDragStart = () => {
    draggingRef.current = true;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    window.setTimeout(() => {
      draggingRef.current = false;
    }, 0);

    if (!over) return;
    const dayIso = String(over.id).replace("day:", "");
    const targetDay = days.find((d) => d.iso === dayIso);
    if (!targetDay) return;

    const evt = active.data.current?.event as CalendarEvent | undefined;
    const translated = active.rect.current.translated;
    if (!evt || !translated) return;

    const minutes = snapMinutes(((translated.top - over.rect.top) / hourHeight) * 60);
    const d = new Date(targetDay.date);
    const newStart = new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      Math.floor(minutes / 60),
      minutes % 60
    );
    const durationMs = new Date(evt.ends_at).getTime() - new Date(evt.starts_at).getTime();
    const newStartISO = newStart.toISOString();
    const newEndISO = new Date(newStart.getTime() + durationMs).toISOString();
    if (newStartISO === evt.starts_at && newEndISO === evt.ends_at) return; // no-op
    onMoveEvent(evt.id, newStartISO, newEndISO);
  };

  // A cancelled drag (Escape, sensor deactivation) never reaches handleDragEnd,
  // so clear the flag here too — otherwise every later click would be swallowed.
  const handleDragCancel = () => {
    draggingRef.current = false;
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex overflow-x-auto pb-2">
        {/* Hour labels */}
        <div className="sticky left-0 z-20 w-14 shrink-0 select-none border-r border-border-subtle bg-base">
          {HOURS.map((h) => (
            <div key={h} className="relative" style={{ height: hourHeight }}>
              <span className="absolute -top-2 right-2 text-[10px] tabular-nums text-faint">
                {format(new Date(2020, 0, 1, h), "h a")}
              </span>
            </div>
          ))}
        </div>

        {days.map((day) => {
          const isToday = day.iso === todayISO;
          const timedEvents = day.events.filter((e) => !e.all_day);
          const allDayEvents = day.events.filter((e) => e.all_day);
          const layouts = layoutsByDay.get(day.iso);
          const nowTop = isToday
            ? (minutesSinceMidnight(new Date().toISOString()) / 60) * hourHeight
            : null;

          return (
            <div
              key={day.iso}
              className={cn(
                "flex min-w-40 flex-1 flex-col border-l border-border-subtle",
                isToday && "bg-accent-muted/5"
              )}
            >
              {/* Day header */}
              <div className="flex items-baseline justify-center gap-1.5 px-2 pb-1.5 pt-2">
                <span
                  className={cn(
                    "text-xs font-semibold",
                    isToday ? "text-accent" : "text-foreground"
                  )}
                >
                  {format(day.date, "EEE")}
                </span>
                <span className="text-xs font-medium text-faint">{day.date.getDate()}</span>
              </div>

              {/* All-day strip: all-day events + due tasks */}
              <div className="space-y-1 border-b border-border-subtle px-1.5 pb-2">
                {allDayEvents.map((e) => (
                  <EventPill key={e.id} event={e} onOpen={guardedOpen} />
                ))}
                {day.tasks.map((t) => (
                  <TaskPill key={t.id} task={t} />
                ))}
              </div>

              {/* Timed area */}
              <TimedColumn
                iso={day.iso}
                hourHeight={hourHeight}
                onPointerDown={handleSelectStart(day.iso)}
                onPointerMove={handleSelectMove}
                onPointerUp={handleSelectEnd}
              >
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="pointer-events-none absolute inset-x-0 border-t border-border-subtle/60"
                    style={{ top: h * hourHeight }}
                  />
                ))}

                {nowTop !== null && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
                    style={{ top: nowTop }}
                  >
                    <span className="size-1.5 rounded-full bg-destructive" />
                    <div className="h-px flex-1 bg-destructive" />
                  </div>
                )}

                {timedEvents.map((e) => {
                  const layout = layouts?.get(e.id);
                  if (!layout) return null;
                  return (
                    <EventBlock
                      key={e.id}
                      event={e}
                      layout={layout}
                      hourHeight={hourHeight}
                      onOpen={guardedOpen}
                    />
                  );
                })}

                {selection?.dayIso === day.iso && (
                  <div
                    className="pointer-events-none absolute z-10 rounded-md bg-accent/20 ring-1 ring-accent/40"
                    style={{
                      top: (Math.min(selection.startMin, selection.endMin) / 60) * hourHeight,
                      height:
                        (Math.abs(selection.endMin - selection.startMin) / 60) * hourHeight,
                    }}
                  />
                )}
              </TimedColumn>
            </div>
          );
        })}
      </div>
    </DndContext>
  );
}

function TimedColumn({
  iso,
  hourHeight,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  children,
}: {
  iso: string;
  hourHeight: number;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: () => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${iso}` });
  return (
    <div
      ref={setNodeRef}
      className={cn("relative flex-1", isOver && "bg-accent-muted/20")}
      style={{ height: 24 * hourHeight }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {children}
    </div>
  );
}
