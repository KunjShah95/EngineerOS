"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { TaskBlock } from "@/components/calendar/TaskBlock";
import { TaskPill } from "@/components/calendar/TaskPill";
import { toISODate } from "@/lib/calendar";
import {
  DAY_MINUTES,
  HOUR_HEIGHT,
  MINUTE_SNAP,
  layoutEventColumns,
  minutesSinceMidnight,
  snapMinutes,
  taskTimedRange,
  type GridEventLike,
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
  /** Persist new start/end times — used by drag-to-move and drag-to-resize. */
  onMoveEvent: (id: string, startsAt: string, endsAt: string) => void;
  /** Open a task (deep link / task panel). */
  onOpenTask: (id: string) => void;
  /** Persist a task resize — new start/end with the opposite boundary fixed. */
  onResizeTask: (id: string, startsAt: string, endsAt: string) => void;
  /** Persist a task drag — new day + start time + duration. */
  onMoveTask?: (id: string, startsAt: string, endsAt: string) => void;
  hourHeight?: number;
  className?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

/** Width of the time gutter. Also the width of the header's corner cell, so the
 *  sticky header's day columns register exactly with the grid columns. */
const GUTTER_PX = 56;

/** Narrowest the grid gets before the wrapper starts scrolling horizontally. */
const MIN_GRID_WIDTH = 720;

/** Quiet shading for hours outside a nominal working day. */
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 18;

/** "GMT+5:30" — the corner label, so a mixed-timezone week is never ambiguous. */
function gmtLabel(): string {
  const offset = -new Date().getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `GMT${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}`;
}

/** Ticks every 30s so the now-line doesn't visibly lag behind the clock. */
function useNowMinutes(): number {
  const [now, setNow] = useState(() => minutesSinceMidnight(new Date().toISOString()));
  useEffect(() => {
    const id = window.setInterval(
      () => setNow(minutesSinceMidnight(new Date().toISOString())),
      30_000
    );
    return () => window.clearInterval(id);
  }, []);
  return now;
}

export function HourGrid({
  days,
  onOpenEvent,
  onCreateEvent,
  onMoveEvent,
  onOpenTask,
  onResizeTask,
  onMoveTask,
  hourHeight = HOUR_HEIGHT,
  className,
}: HourGridProps) {
  const todayISO = toISODate(new Date());
  const nowMin = useNowMinutes();

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

  const gridHeight = (DAY_MINUTES / 60) * hourHeight;
  const tzLabel = useMemo(() => gmtLabel(), []);

  // Per-day side-by-side layout for timed events AND timed tasks (they share
  // the timed axis, so overlaps resolve side-by-side across both kinds).
  const layoutsByDay = useMemo(() => {
    const map = new Map<string, Map<string, TimedLayout>>();
    for (const day of days) {
      const timedEvents = day.events.filter((e) => !e.all_day);
      const timedTasks = day.tasks
        .map((t) => taskTimedRange(t))
        .filter((r): r is GridEventLike => r !== null);
      map.set(day.iso, layoutEventColumns(day.iso, [...timedEvents, ...timedTasks], hourHeight));
    }
    return map;
  }, [days, hourHeight]);

  // The all-day strip only earns its height when something lands in it —
  // otherwise the row collapses and the timed grid starts at the top.
  const hasAllDay = useMemo(
    () =>
      days.some(
        (day) =>
          day.events.some((e) => e.all_day) ||
          day.tasks.some((t) => taskTimedRange(t) === null)
      ),
    [days]
  );

  // Auto-scroll: land on the working day, not on midnight. Re-runs only when the
  // visible range changes, so a background refetch (or the 30s clock tick) can't
  // yank the viewport back while the user is reading it.
  const rangeKey = days.map((d) => d.iso).join(",");
  const containsToday = days.some((d) => d.iso === todayISO);
  const nowMinRef = useRef(nowMin);
  useEffect(() => {
    nowMinRef.current = nowMin;
  }, [nowMin]);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const id = window.requestAnimationFrame(() => {
      const focusMin = containsToday ? nowMinRef.current : DAY_START_HOUR * 60;
      const focusPx = (focusMin / 60) * hourHeight;
      el.scrollTop = Math.max(0, focusPx - el.clientHeight / 3);
    });
    return () => window.cancelAnimationFrame(id);
  }, [rangeKey, hourHeight, containsToday]);

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

    // Events carry starts_at/ends_at directly; a dragged task exposes them via
    // the pseudo-range `taskTimedRange` builds (due date + time + duration).
    const evt = active.data.current?.event as CalendarEvent | undefined;
    const task = active.data.current?.task as TaskWithProject | undefined;
    const moved: GridEventLike | undefined = evt ?? (task ? taskTimedRange(task) ?? undefined : undefined);
    const translated = active.rect.current.translated;
    if (!moved || !translated) return;

    const minutes = snapMinutes(((translated.top - over.rect.top) / hourHeight) * 60);
    const d = new Date(targetDay.date);
    const newStart = new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      Math.floor(minutes / 60),
      minutes % 60
    );
    const durationMs =
      new Date(moved.ends_at).getTime() - new Date(moved.starts_at).getTime();
    const newEnd = new Date(newStart.getTime() + durationMs);
    // Compare instants, not strings: a task's pseudo-range is stored as a local
    // wall-clock string while the drop result is an ISO/UTC one, so a string
    // comparison would report a no-op drag as a real move.
    if (newStart.getTime() === new Date(moved.starts_at).getTime()) return; // no-op

    const newStartISO = newStart.toISOString();
    const newEndISO = newEnd.toISOString();
    if (evt) onMoveEvent(moved.id, newStartISO, newEndISO);
    else onMoveTask?.(moved.id, newStartISO, newEndISO);
  };

  // A cancelled drag (Escape, sensor deactivation) never reaches handleDragEnd,
  // so clear the flag here too — otherwise every later click would be swallowed.
  const handleDragCancel = () => {
    draggingRef.current = false;
  };

  const columnTemplate = `repeat(${days.length}, minmax(0, 1fr))`;
  const headerTemplate = `${GUTTER_PX}px ${columnTemplate}`;
  const showNow = days.some((d) => d.iso === todayISO);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-default bg-base",
          className
        )}
      >
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
          <div className="select-none" style={{ minWidth: MIN_GRID_WIDTH }}>
            {/* ---- Sticky header: day names, then the all-day strip ---- */}
            <div className="sticky top-0 z-30 bg-base/95 backdrop-blur-sm">
              <div className="grid" style={{ gridTemplateColumns: headerTemplate }}>
                <div className="flex items-end justify-end pr-2 pb-1.5">
                  <span className="figure-mono text-[10px] text-faint">{tzLabel}</span>
                </div>
                {days.map((day) => {
                  const isToday = day.iso === todayISO;
                  return (
                    <div
                      key={day.iso}
                      className={cn(
                        "flex flex-col items-center gap-0.5 border-l border-border-subtle py-1.5",
                        isToday && "bg-accent/[0.06]"
                      )}
                    >
                      <span
                        className={cn(
                          "text-[10px] font-medium uppercase tracking-[0.08em]",
                          isToday ? "text-accent" : "text-secondary"
                        )}
                      >
                        {format(day.date, days.length === 1 ? "EEEE" : "EEE")}
                      </span>
                      <span
                        className={cn(
                          "figure-mono flex size-6 items-center justify-center rounded-full text-[13px] font-semibold",
                          isToday
                            ? "bg-accent text-accent-foreground"
                            : "text-foreground"
                        )}
                      >
                        {day.date.getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>

              {hasAllDay && (
                <div
                  className="grid border-y border-border-subtle bg-surface/40"
                  style={{ gridTemplateColumns: headerTemplate }}
                >
                  <div className="flex items-start justify-end pr-2 pt-1.5">
                    <span className="label-mono !text-[9px]">all&#8209;day</span>
                  </div>
                  {days.map((day) => {
                    const allDayEvents = day.events.filter((e) => e.all_day);
                    const untimedTasks = day.tasks.filter((t) => taskTimedRange(t) === null);
                    return (
                      <div
                        key={day.iso}
                        className="min-h-8 space-y-1 border-l border-border-subtle p-1"
                      >
                        {allDayEvents.map((e) => (
                          <EventPill key={e.id} event={e} onOpen={guardedOpen} />
                        ))}
                        {untimedTasks.map((t) => (
                          <TaskPill key={t.id} task={t} />
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ---- Timed grid: gutter + day columns ---- */}
            <div
              className="relative grid"
              style={{ gridTemplateColumns: `${GUTTER_PX}px minmax(0, 1fr)` }}
            >
              {/* Time gutter — sticky so the hour stays readable on scroll */}
              <div
                className="sticky left-0 z-20 bg-base"
                style={{ height: gridHeight }}
              >
                {HOURS.map((h) => (
                  <div key={h} className="relative" style={{ height: hourHeight }}>
                    {/* Centred on the hour rule it labels. Midnight has no rule
                        above it, so its label sits just below the top edge. */}
                    <span
                      className={cn(
                        "figure-mono absolute right-2 whitespace-nowrap text-[10px] leading-none text-secondary",
                        h === 0 ? "top-1" : "-translate-y-1/2"
                      )}
                      style={h === 0 ? undefined : { top: 0 }}
                    >
                      {format(new Date(2020, 0, 1, h), "h a")}
                    </span>
                  </div>
                ))}
              </div>

              {/* Day columns */}
              <div
                className="relative grid"
                style={{ gridTemplateColumns: columnTemplate, height: gridHeight }}
              >
                {/* Off-hours wash */}
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    backgroundImage: `linear-gradient(to bottom, color-mix(in srgb, var(--text-primary) 4%, transparent) 0 ${DAY_START_HOUR * hourHeight}px, transparent ${DAY_START_HOUR * hourHeight}px ${DAY_END_HOUR * hourHeight}px, color-mix(in srgb, var(--text-primary) 4%, transparent) ${DAY_END_HOUR * hourHeight}px 100%)`,
                  }}
                  aria-hidden
                />
                {/* Hour rules, then the lighter half-hour rules on top of them */}
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    backgroundImage:
                      "linear-gradient(to bottom, var(--border-subtle) 1px, transparent 1px)",
                    backgroundSize: `100% ${hourHeight}px`,
                  }}
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    backgroundImage:
                      "linear-gradient(to bottom, color-mix(in srgb, var(--border-subtle) 55%, transparent) 1px, transparent 1px)",
                    backgroundSize: `100% ${hourHeight / 2}px`,
                    backgroundPosition: `0 ${hourHeight / 2}px`,
                  }}
                  aria-hidden
                />

                {days.map((day) => {
                  const isToday = day.iso === todayISO;
                  const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
                  const timedEvents = day.events.filter((e) => !e.all_day);
                  // Tasks with a due_time are timed blocks; the rest live in
                  // the all-day strip above.
                  const timedTasks = day.tasks.filter((t) => taskTimedRange(t) !== null);
                  const layouts = layoutsByDay.get(day.iso);

                  return (
                    <div
                      key={day.iso}
                      className={cn(
                        "relative border-l border-border-subtle",
                        isToday && "bg-accent/[0.05]",
                        !isToday && isWeekend && "bg-surface/30"
                      )}
                    >
                      <TimedColumn
                        iso={day.iso}
                        onPointerDown={handleSelectStart(day.iso)}
                        onPointerMove={handleSelectMove}
                        onPointerUp={handleSelectEnd}
                      >
                        {timedEvents.map((e) => {
                          const layout = layouts?.get(e.id);
                          if (!layout) return null;
                          return (
                            <EventBlock
                              key={e.id}
                              event={e}
                              layout={layout}
                              hourHeight={hourHeight}
                              dayIso={day.iso}
                              onOpen={guardedOpen}
                              onResize={onMoveEvent}
                            />
                          );
                        })}

                        {timedTasks.map((t) => {
                          const layout = layouts?.get(t.id);
                          if (!layout) return null;
                          return (
                            <TaskBlock
                              key={t.id}
                              task={t}
                              layout={layout}
                              hourHeight={hourHeight}
                              dayIso={day.iso}
                              onOpen={onOpenTask}
                              onResize={onResizeTask}
                            />
                          );
                        })}

                        {selection?.dayIso === day.iso && (
                          <div
                            className="pointer-events-none absolute inset-x-0.5 z-10 overflow-hidden rounded-[4px] bg-accent/20 ring-1 ring-accent/50"
                            style={{
                              top: (Math.min(selection.startMin, selection.endMin) / 60) * hourHeight,
                              height:
                                (Math.max(MINUTE_SNAP, Math.abs(selection.endMin - selection.startMin)) /
                                  60) *
                                hourHeight,
                            }}
                          >
                            <span className="figure-mono block px-1 pt-0.5 text-[10px] font-medium text-accent">
                              {format(new Date(2020, 0, 1, Math.floor(selection.startMin / 60), selection.startMin % 60), "h:mm a")}
                              {" – "}
                              {format(
                                new Date(
                                  2020,
                                  0,
                                  1,
                                  Math.floor(Math.max(selection.startMin, selection.endMin) / 60),
                                  Math.max(selection.startMin, selection.endMin) % 60
                                ),
                                "h:mm a"
                              )}
                            </span>
                          </div>
                        )}
                      </TimedColumn>
                    </div>
                  );
                })}

                </div>

              {/* Now-line — a sibling of the gutter so its time label lands in
                  the gutter and the rule crosses every day column. */}
              {showNow && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-30 flex items-center"
                  style={{ top: (nowMin / 60) * hourHeight }}
                  aria-hidden
                >
                  <span className="figure-mono shrink-0 pr-2 text-right text-[10px] font-semibold leading-none text-danger" style={{ width: GUTTER_PX }}>
                    {format(new Date(), "h:mm a")}
                  </span>
                  <span className="size-1.5 shrink-0 rounded-full bg-danger" />
                  <span className="h-px flex-1 bg-danger" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DndContext>
  );
}

function TimedColumn({
  iso,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  children,
}: {
  iso: string;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: () => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${iso}` });
  return (
    <div
      ref={setNodeRef}
      className={cn("absolute inset-0", isOver && "bg-accent/10")}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {children}
    </div>
  );
}