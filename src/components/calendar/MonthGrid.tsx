"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { priorityColor } from "@/lib/task-meta";
import { EVENT_COLORS, eventTimeLabel } from "@/lib/calendar-events";
import type { CalendarEvent, TaskWithProject } from "@/types/database";

interface MonthDay {
  iso: string;
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  tasks: TaskWithProject[];
  events: CalendarEvent[];
  hasNote: boolean;
}

interface MonthGridProps {
  days: MonthDay[];
  onOpenTask: (id: string) => void;
  onOpenEvent: (id: string) => void;
  onOpenDay: (iso: string) => void;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function MonthGrid({ days, onOpenTask, onOpenEvent, onOpenDay }: MonthGridProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-default">
      <div className="grid grid-cols-7 border-b border-default bg-surface">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="label-mono py-2 text-center">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const visibleEvents = day.events.slice(0, 3);
          const taskBudget = Math.max(0, 3 - visibleEvents.length);
          const visibleTasks = day.tasks.slice(0, taskBudget);
          const overflow =
            day.events.length + day.tasks.length - visibleEvents.length - visibleTasks.length;

          return (
            <div
              key={day.iso}
              className={cn(
                "min-h-[104px] border-border-subtle p-1.5",
                i % 7 !== 6 && "border-r",
                i < days.length - 7 && "border-b",
                !day.isCurrentMonth && "bg-surface/40",
                day.isToday && "bg-accent/[0.06]"
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <Link
                  href={`/daily/${day.iso}`}
                  className={cn(
                    "figure-mono flex size-6 items-center justify-center rounded-full text-xs font-medium text-foreground transition-colors hover:bg-surface-hover",
                    day.isToday && "bg-accent text-accent-foreground hover:bg-accent",
                    !day.isCurrentMonth && "text-faint"
                  )}
                >
                  {day.date.getDate()}
                </Link>
                {day.hasNote && (
                  <span
                    className="size-1.5 rounded-full bg-signal"
                    title="Has daily note"
                    aria-label="Has journal entry"
                  />
                )}
              </div>

              <div className="space-y-px">
                {visibleEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    title={event.title}
                    aria-label={event.title}
                    onClick={() => onOpenEvent(event.id)}
                    className="flex h-[18px] w-full min-w-0 items-center gap-1 rounded-[3px] px-1 text-left text-[11px] leading-none text-foreground transition-[filter] hover:brightness-125"
                    style={{
                      backgroundColor: `${EVENT_COLORS[event.color]}26`,
                      boxShadow: `inset 2px 0 0 0 ${EVENT_COLORS[event.color]}`,
                    }}
                  >
                    {!event.all_day && (
                      <span className="figure-mono shrink-0 text-[10px] text-secondary">
                        {eventTimeLabel(event)}
                      </span>
                    )}
                    <span className="truncate">{event.title}</span>
                  </button>
                ))}
                {visibleTasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    title={task.title}
                    aria-label={task.title}
                    onClick={() => onOpenTask(task.id)}
                    className={cn(
                      "flex h-[18px] w-full min-w-0 items-center gap-1 rounded-[3px] px-1 text-left text-[11px] leading-none transition-colors hover:bg-surface-hover",
                      task.status === "done" ? "text-secondary line-through" : "text-foreground"
                    )}
                  >
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: priorityColor(task.priority) }}
                      aria-hidden
                    />
                    <span className="truncate">{task.title}</span>
                  </button>
                ))}
                {overflow > 0 && (
                  <button
                    type="button"
                    onClick={() => onOpenDay(day.iso)}
                    className="w-full truncate rounded-[3px] px-1 text-left text-[10px] font-medium leading-[18px] text-accent transition-colors hover:bg-accent-muted/40"
                  >
                    +{overflow} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
