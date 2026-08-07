"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Download,
  LayoutGrid,
  Plus,
  Rows3,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import { HourGrid, type HourGridDay } from "@/components/calendar/HourGrid";
import { UnscheduledStrip } from "@/components/calendar/UnscheduledStrip";
import { MonthGrid } from "@/components/calendar/MonthGrid";
import { EventEditorModal } from "@/components/calendar/EventEditorModal";
import { TaskDetailPanel } from "@/components/task/TaskDetailPanel";
import { EmptyState } from "@/components/shell/EmptyState";
import { PageLoader } from "@/components/shell/PageLoader";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { useDailyNotesInRange } from "@/hooks/useDailyNotes";
import { useTasks } from "@/hooks/useTasks";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useEvents, useUpdateEvent } from "@/hooks/useEvents";
import {
  addDays,
  buildMonthGrid,
  buildWeek,
  formatMonthYear,
  formatWeekRange,
  startOfWeek,
  toISODate,
} from "@/lib/calendar";
import { bucketEventsByDate } from "@/lib/calendar-events";
import { minutesToLocalInput } from "@/lib/calendar-grid";
import { cn } from "@/lib/utils";
import type { CalendarEvent, TaskWithProject } from "@/types/database";

type CalendarView = "day" | "week" | "month";

export function CalendarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: workspace } = useWorkspace();
  const workspaceId = workspace?.id ?? null;

  const [view, setView] = useState<CalendarView>("week");
  const [anchor, setAnchor] = useState<Date>(() => startOfWeek(new Date()));

  const openTaskId = searchParams.get("task");
  const openEventId = searchParams.get("event");
  const [editorEvent, setEditorEvent] = useState<CalendarEvent | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [createStart, setCreateStart] = useState<string | null>(null);
  const [createEnd, setCreateEnd] = useState<string | null>(null);

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

  const dayISO = toISODate(anchor);
  const from = view === "week" ? weekDates[0] : view === "day" ? dayISO : monthDays[0].iso;
  const to = view === "week" ? weekDates[6] : view === "day" ? dayISO : monthDays[41].iso;

  const { data: tasks, isLoading, isError } = useTasks(workspaceId);
  const { data: noteDates } = useDailyNotesInRange(workspaceId, from, to);

  const { data: events } = useEvents(workspaceId, from, to);
  const eventsByDate = useMemo(() => bucketEventsByDate(events ?? []), [events]);

  // Deep link from a notification: ?event= in the URL drives the editor, so
  // the modal state is derived from the param rather than mirrored in state.
  const deepLinkedEvent = openEventId
    ? (events ?? []).find((e) => e.id === openEventId) ?? null
    : null;

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

  const hourDays: HourGridDay[] = useMemo(() => {
    const dates = view === "day" ? [anchor] : weekDates.map((iso, i) => addDays(weekStart, i));
    return dates.map((date) => {
      const iso = toISODate(date);
      return { iso, date, tasks: byDate.get(iso) ?? [], events: eventsByDate.get(iso) ?? [] };
    });
  }, [view, anchor, weekDates, weekStart, byDate, eventsByDate]);

  const hasNote = useMemo(() => new Set(noteDates ?? []), [noteDates]);
  const todayISO = toISODate(new Date());
  const updateEvent = useUpdateEvent(workspaceId);

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

  const clearEventParam = () => {
    if (!openEventId) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("event");
    router.replace(`/calendar${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const openEvent = (id: string) => {
    // The ?event= param drives the editor (see deepLinkedEvent above).
    const params = new URLSearchParams(searchParams.toString());
    params.set("event", id);
    router.replace(`/calendar?${params.toString()}`);
  };

  const openCreateAt = (iso: string, startMinutes: number, endMinutes: number) => {
    clearEventParam();
    setEditorEvent(null);
    setCreateStart(minutesToLocalInput(iso, startMinutes));
    setCreateEnd(minutesToLocalInput(iso, endMinutes));
    setEditorOpen(true);
  };

  const newEvent = () => {
    clearEventParam();
    setEditorEvent(null);
    setCreateStart(`${todayISO}T09:00`);
    setCreateEnd(`${todayISO}T10:00`);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    clearEventParam();
    setEditorOpen(false);
    setEditorEvent(null);
    setCreateStart(null);
    setCreateEnd(null);
  };

  const goBack = () => {
    if (view === "week") setAnchor(addDays(weekStart, -7));
    else if (view === "day") setAnchor(addDays(anchor, -1));
    else setAnchor(new Date(monthYear, monthMonth - 1, 1));
  };

  const goForward = () => {
    if (view === "week") setAnchor(addDays(weekStart, 7));
    else if (view === "day") setAnchor(addDays(anchor, 1));
    else setAnchor(new Date(monthYear, monthMonth + 1, 1));
  };

  const goToday = () => setAnchor(view === "week" ? startOfWeek(new Date()) : new Date());

  const moveEvent = (id: string, startsAt: string, endsAt: string) => {
    updateEvent.mutate(
      { id, patch: { starts_at: startsAt, ends_at: endsAt } },
      { onError: () => toast.error("Couldn't move the event") }
    );
  };

  if (isLoading || !workspace) return <PageLoader label="Loading calendar…" />;
  if (isError)
    return <EmptyState icon={CalendarRange} title="Couldn't load your calendar" description="Try again in a moment." />;

  const monthDayCells = monthDays.map((d) => ({
    ...d,
    tasks: byDate.get(d.iso) ?? [],
    events: eventsByDate.get(d.iso) ?? [],
    hasNote: hasNote.has(d.iso),
    isToday: d.iso === todayISO,
  }));

  const heading = view === "week"
    ? formatWeekRange(weekStart)
    : view === "day"
      ? format(anchor, "EEEE, MMM d, yyyy")
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
            <Button variant="ghost" size="sm" aria-label="New event" onClick={newEvent}>
              <Plus className="size-4" strokeWidth={1.75} />
              Event
            </Button>

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
                onClick={() => setView("day")}
                aria-label="Day view"
                className={cn(
                  "rounded-md p-1.5 transition-colors",
                  view === "day" ? "bg-accent-muted text-accent" : "text-secondary hover:text-foreground"
                )}
              >
                <CalendarDays className="size-3.5" strokeWidth={1.75} />
              </button>
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

      {view === "month" ? (
        <MonthGrid days={monthDayCells} onOpenTask={openTask} onOpenEvent={openEvent} />
      ) : view === "day" ? (
        <>
          <HourGrid
            days={hourDays}
            onOpenEvent={openEvent}
            onCreateEvent={openCreateAt}
            onMoveEvent={moveEvent}
          />
          <UnscheduledStrip tasks={unscheduled} />
        </>
      ) : tasks?.length === 0 && (events?.length ?? 0) === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="Nothing scheduled yet"
          description="Add an event, or give a task a due date, and it will appear here."
        />
      ) : (
        <>
          <HourGrid
            days={hourDays}
            onOpenEvent={openEvent}
            onCreateEvent={openCreateAt}
            onMoveEvent={moveEvent}
          />
          <UnscheduledStrip tasks={unscheduled} />
        </>
      )}

      {openTaskId && (
        <TaskDetailPanel
          key={openTaskId}
          workspaceId={workspace.id}
          taskId={openTaskId}
          onClose={closeTask}
        />
      )}

      {(deepLinkedEvent !== null || editorOpen) && (
        <EventEditorModal
          workspaceId={workspace.id}
          event={deepLinkedEvent ?? editorEvent}
          initialStart={createStart}
          initialEnd={createEnd}
          onClose={closeEditor}
        />
      )}
    </div>
  );
}
