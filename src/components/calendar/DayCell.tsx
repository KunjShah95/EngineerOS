import Link from "next/link";

import { TaskPill } from "@/components/calendar/TaskPill";
import { EventPill } from "@/components/calendar/EventPill";
import { cn } from "@/lib/utils";
import type { CalendarEvent, TaskWithProject } from "@/types/database";
import { weekdayName } from "@/lib/calendar";

export interface DayCellData {
  iso: string;
  date: Date;
  tasks: TaskWithProject[];
  events: CalendarEvent[];
  hasNote: boolean;
  isToday: boolean;
}

export function DayCell({
  iso,
  date,
  tasks,
  events,
  hasNote,
  isToday,
  onOpenEvent,
}: DayCellData & { onOpenEvent: (id: string) => void }) {
  return (
    <div
      className={cn(
        "flex min-h-[120px] flex-col rounded-lg border border-border-subtle bg-surface p-2",
        isToday && "border-accent/60"
      )}
    >
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-[11px] font-medium text-faint">{weekdayName(date)}</span>
        <span className={cn("text-xs font-semibold", isToday ? "text-accent" : "text-foreground")}>
          {date.getDate()}
        </span>
      </div>

      <div className="mt-1.5 flex flex-1 flex-col gap-1.5">
        {events.map((event) => (
          <EventPill key={event.id} event={event} onOpen={onOpenEvent} />
        ))}
        {tasks.map((task) => (
          <TaskPill key={task.id} task={task} />
        ))}
      </div>

      <div className="mt-1.5 border-t border-border-subtle pt-1">
        <Link
          href={`/daily/${iso}`}
          className={cn(
            "text-[11px] font-medium transition-colors",
            hasNote ? "text-accent hover:text-accent-hover" : "text-faint hover:text-foreground"
          )}
        >
          {hasNote ? "Open note" : "Daily"}
        </Link>
      </div>
    </div>
  );
}
