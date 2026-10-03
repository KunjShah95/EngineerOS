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
import { useTasks, useUpdateTask } from "@/hooks/useTasks";
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
import { minutesToLocalInput, timeOfDay } from "@/lib/calendar-grid";
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
  const updateTask = useUpdateTask(workspaceId);

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

  // Task resize commits as due_time + duration_minutes (the timed-task model),
  // converting the resized range back from instants to local wall-clock parts.
  const resizeTask = (id: string, startsAt: string, endsAt: string) => {
    const duration = Math.max(
      30,
      Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60_000)
    );
    updateTask.mutate(
      { id, patch: { due_time: timeOfDay(startsAt), duration_minutes: duration } },
      { onError: () => toast.error("Couldn't resize the task") }
    );
  };

  // A task drag can change the day, not just the time — so it commits the date
  // alongside the time, unlike a resize which keeps the day fixed.
  const moveTask = (id: string, startsAt: string, endsAt: string) => {
    const start = new Date(startsAt);
    const duration = Math.max(
      30,
      Math.round((new Date(endsAt).getTime() - start.getTime()) / 60_000)
    );
    updateTask.mutate(
      {
        id,
        patch: {
          due_date: toISODate(start),
          due_time: timeOfDay(startsAt),
          duration_minutes: duration,
        },
      },
      { onError: () => toast.error("Couldn't move the task") }
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

  const isEmpty =
    (tasks?.length ?? 0) === 0 && (events?.length ?? 0) === 0;

  const header = (
    <PageHeader
      icon={CalendarRange}
      title="Calendar"
      description={heading}
      className="mb-3 shrink-0"
      actions={
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            aria-label="New event"
            onClick={newEvent}
            className="border-default bg-surface hover:bg-surface-hover"
          >
            <Plus className="size-4" strokeWidth={1.75} />
            Event
          </Button>

          <Button
            variant="ghost"
            size="sm"
            aria-label="Export calendar (iCal)"
            title="Export due tasks as .ics"
            onClick={() => { window.location.href = "/api/calendar/export"; }}
            className="text-secondary hover:text-foreground"
          >
            <Download className="size-4" strokeWidth={1.75} />
            <span className="hidden sm:inline">iCal</span>
          </Button>

          {/* Prev / Today / Next — one grouped control, Google-style. */}
          <div className="ml-1 flex items-center rounded-md border border-default bg-surface p-0.5">
            <button
              type="button"
              onClick={goBack}
              aria-label={`Previous ${view === "month" ? "month" : view === "day" ? "day" : "week"}`}
              className="rounded p-1 text-secondary transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              <ChevronLeft className="size-4" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={goToday}
              title="Jump to today"
              className="rounded px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-surface-hover"
            >
              Today
            </button>
            <button
              type="button"
              onClick={goForward}
              aria-label={`Next ${view === "month" ? "month" : view === "day" ? "day" : "week"}`}
              className="rounded p-1 text-secondary transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              <ChevronRight className="size-4" strokeWidth={1.75} />
            </button>
          </div>

          {/* View toggle */}
          <div
            role="tablist"
            aria-label="Calendar view"
            className="flex items-center rounded-md border border-default bg-surface p-0.5"
          >
            {(
              [
                { key: "day", label: "Day", Icon: CalendarDays },
                { key: "week", label: "Week", Icon: Rows3 },
                { key: "month", label: "Month", Icon: LayoutGrid },
              ] as const
            ).map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={view === key}
                aria-label={`${label} view`}
                onClick={() => setView(key)}
                className={cn(
                  "flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors",
                  view === key
                    ? "bg-accent-muted text-accent"
                    : "text-secondary hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" strokeWidth={1.75} />
                <span className="hidden md:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>
      }
    />
  );

  // Month is a document — it scrolls with the page. The time grid is an
  // instrument: it fills the viewport and owns its own scroll.
  if (view === "month") {
    return (
      <div className="mx-auto w-full max-w-6xl px-6 py-6">
        {header}
        {isEmpty ? (
          <EmptyState
            icon={CalendarRange}
            title="Nothing on the calendar yet"
            description="Add an event, or give a task a due date, and it will appear here."
            actionLabel="New event"
            onAction={newEvent}
          />
        ) : (
          <MonthGrid
            days={monthDayCells}
            onOpenTask={openTask}
            onOpenEvent={openEvent}
            onOpenDay={(iso) => {
              setAnchor(new Date(`${iso}T12:00:00`));
              setView("day");
            }}
          />
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

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col px-4 pb-4 pt-5 sm:px-6">
      {header}

      {isEmpty ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <EmptyState
            icon={CalendarRange}
            title={view === "day" ? "Nothing scheduled on this day" : "Nothing scheduled yet"}
            description="Add an event, or give a task a due date, and it will appear here."
            actionLabel="New event"
            onAction={newEvent}
          />
        </div>
      ) : (
        <>
          <HourGrid
            days={hourDays}
            onOpenEvent={openEvent}
            onCreateEvent={openCreateAt}
            onMoveEvent={moveEvent}
            onOpenTask={openTask}
            onResizeTask={resizeTask}
            onMoveTask={moveTask}
          />
          <UnscheduledStrip
            tasks={unscheduled}
            onOpenTask={openTask}
            onOpenBoard={() => router.push("/tasks")}
          />
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
