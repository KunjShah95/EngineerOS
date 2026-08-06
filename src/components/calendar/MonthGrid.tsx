"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { priorityColor } from "@/lib/task-meta";
import type { TaskWithProject } from "@/types/database";

interface MonthDay {
  iso: string;
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  tasks: TaskWithProject[];
  hasNote: boolean;
}

interface MonthGridProps {
  days: MonthDay[];
  onOpenTask: (id: string) => void;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function MonthGrid({ days, onOpenTask }: MonthGridProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-default">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-default bg-surface">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-secondary">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const overdueTasks = day.tasks.filter(
            (t) => t.due_date && t.due_date < day.iso && t.status !== "done"
          );
          const visible = day.tasks.slice(0, 3);
          const overflow = day.tasks.length - 3;

          return (
            <div
              key={day.iso}
              className={cn(
                "min-h-[100px] border-border-subtle p-1.5",
                i % 7 !== 6 && "border-r",
                i < days.length - 7 && "border-b",
                !day.isCurrentMonth && "bg-surface/40",
                day.isToday && "bg-accent-muted/10"
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <Link
                  href={`/daily/${day.iso}`}
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs font-medium transition-colors hover:bg-surface-hover",
                    day.isToday && "bg-accent text-accent-foreground hover:bg-accent",
                    !day.isCurrentMonth && "text-faint"
                  )}
                >
                  {day.date.getDate()}
                </Link>
                {day.hasNote && (
                  <span className="size-1.5 rounded-full bg-accent" title="Has daily note" />
                )}
              </div>

              <div className="space-y-0.5">
                {visible.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onOpenTask(task.id)}
                    className={cn(
                      "w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] leading-tight transition-colors hover:opacity-80",
                      task.status === "done"
                        ? "text-faint line-through"
                        : "text-foreground"
                    )}
                    style={{
                      backgroundColor: `${priorityColor(task.priority)}22`,
                      borderLeft: `2px solid ${priorityColor(task.priority)}`,
                    }}
                  >
                    {task.title}
                  </button>
                ))}
                {overflow > 0 && (
                  <span className="block px-1 text-[10px] text-faint">
                    +{overflow} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
