"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarRange } from "lucide-react";

import type { DayCellData } from "@/components/calendar/DayCell";
import { UnscheduledStrip } from "@/components/calendar/UnscheduledStrip";
import { WeekGrid } from "@/components/calendar/WeekGrid";
import { EmptyState } from "@/components/shell/EmptyState";
import { PageLoader } from "@/components/shell/PageLoader";
import { Button } from "@/components/ui/button";
import { useDailyNotesInRange } from "@/hooks/useDailyNotes";
import { useTasks } from "@/hooks/useTasks";
import { useWorkspace } from "@/hooks/useWorkspace";
import { addDays, buildWeek, formatWeekRange, startOfWeek, toISODate } from "@/lib/calendar";
import type { TaskWithProject } from "@/types/database";

export function CalendarPage() {
  const { data: workspace } = useWorkspace();
  const workspaceId = workspace?.id ?? null;

  const [anchor, setAnchor] = useState<Date>(() => startOfWeek(new Date()));
  const weekStart = startOfWeek(anchor);
  const weekDates = useMemo(() => buildWeek(weekStart), [weekStart]);

  const from = weekDates[0];
  const to = weekDates[6];

  const { data: tasks, isLoading, isError } = useTasks(workspaceId);
  const { data: noteDates } = useDailyNotesInRange(workspaceId, from, to);

  const { byDate, unscheduled } = useMemo(() => {
    const map = new Map<string, TaskWithProject[]>();
    const rest: TaskWithProject[] = [];
    for (const task of tasks ?? []) {
      if (task.due_date) {
        const list = map.get(task.due_date) ?? [];
        list.push(task);
        map.set(task.due_date, list);
      } else {
        rest.push(task);
      }
    }
    return { byDate: map, unscheduled: rest };
  }, [tasks]);

  const hasNote = useMemo(() => new Set(noteDates ?? []), [noteDates]);
  const todayISO = toISODate(new Date());

  if (isLoading || !workspace) return <PageLoader label="Loading calendar…" />;
  if (isError)
    return <EmptyState icon={CalendarRange} title="Couldn’t load your calendar" description="Try again in a moment." />;

  const days: DayCellData[] = weekDates.map((iso, i) => ({
    iso,
    date: addDays(weekStart, i),
    tasks: byDate.get(iso) ?? [],
    hasNote: hasNote.has(iso),
    isToday: iso === todayISO,
  }));

  const isEmpty = tasks?.length === 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Calendar</h1>
          <p className="text-sm text-faint">{formatWeekRange(weekStart)}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous week"
            onClick={() => setAnchor(addDays(weekStart, -7))}
          >
            <ChevronLeft className="size-4" strokeWidth={1.75} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Go to today"
            title="Today"
            onClick={() => setAnchor(startOfWeek(new Date()))}
          >
            <span className="text-xs font-semibold">Today</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next week"
            onClick={() => setAnchor(addDays(weekStart, 7))}
          >
            <ChevronRight className="size-4" strokeWidth={1.75} />
          </Button>
        </div>
      </div>

      {isEmpty ? (
        <EmptyState
          icon={CalendarRange}
          title="Nothing scheduled yet"
          description="Add a task with a due date and it will appear here on that day."
        />
      ) : (
        <>
          <WeekGrid days={days} />
          <UnscheduledStrip tasks={unscheduled} />
        </>
      )}
    </div>
  );
}