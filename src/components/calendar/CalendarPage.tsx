"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, CalendarRange, Download, LayoutGrid, Rows3 } from "lucide-react";

import type { DayCellData } from "@/components/calendar/DayCell";
import { UnscheduledStrip } from "@/components/calendar/UnscheduledStrip";
import { WeekGrid } from "@/components/calendar/WeekGrid";
import { MonthGrid } from "@/components/calendar/MonthGrid";
import { TaskDetailPanel } from "@/components/task/TaskDetailPanel";
import { EmptyState } from "@/components/shell/EmptyState";
import { PageLoader } from "@/components/shell/PageLoader";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { useDailyNotesInRange } from "@/hooks/useDailyNotes";
import { useTasks } from "@/hooks/useTasks";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  addDays,
  buildMonthGrid,
  buildWeek,
  formatMonthYear,
  formatWeekRange,
  startOfWeek,
  toISODate,
} from "@/lib/calendar";
import { cn } from "@/lib/utils";
import type { TaskWithProject } from "@/types/database";

type CalendarView = "week" | "month";

export function CalendarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: workspace } = useWorkspace();
  const workspaceId = workspace?.id ?? null;

  const [view, setView] = useState<CalendarView>("week");
  const [anchor, setAnchor] = useState<Date>(() => startOfWeek(new Date()));

  const openTaskId = searchParams.get("task");

  // Week view state
  const weekStart = startOfWeek(anchor);
  const weekDates = useMemo(() => buildWeek(weekStart), [weekStart]);

  // Month view state
  const monthYear = anchor.getFullYear();
  const monthMonth = anchor.getMonth();
  const monthDays = useMemo(
    () => buildMonthGrid(monthYear, monthMonth),
    [monthYear, monthMonth]
  );

  const from = view === "week" ? weekDates[0] : monthDays[0].iso;
  const to = view === "week" ? weekDates[6] : monthDays[41].iso;

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

  const openTask = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("task", id);
    router.replace(`/calendar?${params.toString()}`);
  };

  const closeTask = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("task");
    router.replace(`/calendar?${params.toString()}`);
  };

  const goBack = () => {
    if (view === "week") setAnchor(addDays(weekStart, -7));
    else setAnchor(new Date(monthYear, monthMonth - 1, 1));
  };

  const goForward = () => {
    if (view === "week") setAnchor(addDays(weekStart, 7));
    else setAnchor(new Date(monthYear, monthMonth + 1, 1));
  };

  const goToday = () => setAnchor(view === "week" ? startOfWeek(new Date()) : new Date());

  if (isLoading || !workspace) return <PageLoader label="Loading calendar…" />;
  if (isError)
    return <EmptyState icon={CalendarRange} title="Couldn't load your calendar" description="Try again in a moment." />;

  const weekDayCells: DayCellData[] = weekDates.map((iso, i) => ({
    iso,
    date: addDays(weekStart, i),
    tasks: byDate.get(iso) ?? [],
    hasNote: hasNote.has(iso),
    isToday: iso === todayISO,
  }));

  const monthDayCells = monthDays.map((d) => ({
    ...d,
    tasks: byDate.get(d.iso) ?? [],
    hasNote: hasNote.has(d.iso),
    isToday: d.iso === todayISO,
  }));

  const heading = view === "week"
    ? formatWeekRange(weekStart)
    : formatMonthYear(monthYear, monthMonth);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-6">
      <PageHeader
        icon={CalendarRange}
        title="Calendar"
        description={heading}
        className="mb-4"
        actions={
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Export calendar (iCal)"
              title="Export due tasks as .ics"
              onClick={() => { window.location.href = "/api/calendar/export"; }}
            >
              <Download className="size-4" strokeWidth={1.75} />
              iCal
            </Button>

            {/* View toggle */}
            <div className="flex items-center rounded-lg border border-default bg-surface p-0.5 mr-1">
              <button
                type="button"
                onClick={() => setView("week")}
                aria-label="Week view"
                className={cn(
                  "rounded-md p-1.5 transition-colors",
                  view === "week" ? "bg-accent-muted text-accent" : "text-secondary hover:text-foreground"
                )}
              >
                <Rows3 className="size-3.5" strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={() => setView("month")}
                aria-label="Month view"
                className={cn(
                  "rounded-md p-1.5 transition-colors",
                  view === "month" ? "bg-accent-muted text-accent" : "text-secondary hover:text-foreground"
                )}
              >
                <LayoutGrid className="size-3.5" strokeWidth={1.75} />
              </button>
            </div>

            <Button variant="ghost" size="icon" aria-label="Previous" onClick={goBack}>
              <ChevronLeft className="size-4" strokeWidth={1.75} />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Today" title="Today" onClick={goToday}>
              <span className="text-xs font-semibold">Today</span>
            </Button>
            <Button variant="ghost" size="icon" aria-label="Next" onClick={goForward}>
              <ChevronRight className="size-4" strokeWidth={1.75} />
            </Button>
          </div>
        }
      />

      {view === "week" ? (
        tasks?.length === 0 ? (
          <EmptyState
            icon={CalendarRange}
            title="Nothing scheduled yet"
            description="Add a task with a due date and it will appear here on that day."
          />
        ) : (
          <>
            <WeekGrid days={weekDayCells} />
            <UnscheduledStrip tasks={unscheduled} />
          </>
        )
      ) : (
        <MonthGrid days={monthDayCells} onOpenTask={openTask} />
      )}

      {openTaskId && (
        <TaskDetailPanel
          key={openTaskId}
          workspaceId={workspace.id}
          taskId={openTaskId}
          onClose={closeTask}
        />
      )}
    </div>
  );
}
