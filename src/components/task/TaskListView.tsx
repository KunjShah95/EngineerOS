"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CalendarDays, CheckCircle2, Circle, GitBranch, Timer } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useBlockedTaskIds,
  useUpdateTask,
  useTasks,
  type TaskFilters,
} from "@/hooks/useTasks";
import { priorityColor, TASK_STATUS_META } from "@/lib/task-meta";
import { projectColorStyle } from "@/lib/project-colors";
import { cn } from "@/lib/utils";
import type { TaskWithProject } from "@/types/database";

interface TaskListViewProps {
  workspaceId: string;
  filters?: TaskFilters | null;
  onOpenTask: (id: string) => void;
}

export function TaskListView({ workspaceId, filters, onOpenTask }: TaskListViewProps) {
  const { data: tasks, isLoading } = useTasks(workspaceId, filters);
  const updateTask = useUpdateTask(workspaceId);
  const { data: blockedIds } = useBlockedTaskIds(workspaceId);
  const today = new Date().toISOString().split("T")[0];

  const [groupBy, setGroupBy] = useState<"status" | "priority">("status");

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const all = tasks ?? [];

  const toggleDone = (task: TaskWithProject) => {
    const next = task.status === "done" ? "todo" : "done";
    updateTask.mutate(
      { id: task.id, patch: { status: next } },
      { onSuccess: () => toast.success(next === "done" ? "Marked done" : "Reopened") }
    );
  };

  if (groupBy === "status") {
    return (
      <div className="space-y-6">
        <GroupToggle value={groupBy} onChange={setGroupBy} />
        {TASK_STATUS_META.map(({ value, label, color }) => {
          const group = all.filter((t) => t.status === value);
          if (group.length === 0) return null;
          return (
            <section key={value}>
              <div className="mb-2 flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-secondary">
                  {label}
                </h3>
                <span className="text-xs text-faint">({group.length})</span>
              </div>
              <div className="overflow-hidden rounded-lg border border-default">
                {group.map((task, i) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    today={today}
                    isLast={i === group.length - 1}
                    onOpen={onOpenTask}
                    onToggleDone={toggleDone}
                    blocked={blockedIds?.has(task.id)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  const priorities = ["urgent", "high", "medium", "low", "none"] as const;
  return (
    <div className="space-y-6">
      <GroupToggle value={groupBy} onChange={setGroupBy} />
      {priorities.map((p) => {
        const group = all.filter((t) => t.priority === p);
        if (group.length === 0) return null;
        return (
          <section key={p}>
            <div className="mb-2 flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ backgroundColor: priorityColor(p) }} aria-hidden />
              <h3 className="text-xs font-semibold uppercase tracking-wide text-secondary capitalize">
                {p === "none" ? "No priority" : p}
              </h3>
              <span className="text-xs text-faint">({group.length})</span>
            </div>
            <div className="overflow-hidden rounded-lg border border-default">
              {group.map((task, i) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  today={today}
                  isLast={i === group.length - 1}
                  onOpen={onOpenTask}
                  onToggleDone={toggleDone}
                  blocked={blockedIds?.has(task.id)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function TaskRow({
  task,
  today,
  isLast,
  onOpen,
  onToggleDone,
  blocked = false,
}: {
  task: TaskWithProject;
  today: string;
  isLast: boolean;
  onOpen: (id: string) => void;
  onToggleDone: (task: TaskWithProject) => void;
  blocked?: boolean;
}) {
  const isOverdue = task.due_date && task.due_date < today && task.status !== "done";
  const isDone = task.status === "done";

  return (
    <div
      className={cn(
        "flex items-center gap-3 bg-surface px-4 py-3 transition-colors hover:bg-surface-hover",
        !isLast && "border-b border-border-subtle"
      )}
    >
      <button
        type="button"
        onClick={() => onToggleDone(task)}
        aria-label={isDone ? "Reopen" : "Mark done"}
        className="shrink-0 text-secondary transition-colors hover:text-foreground"
      >
        {isDone ? (
          <CheckCircle2 className="size-4 text-success" strokeWidth={1.75} />
        ) : (
          <Circle className="size-4" strokeWidth={1.75} />
        )}
      </button>

      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: priorityColor(task.priority) }}
        aria-hidden
      />

      <button
        type="button"
        onClick={() => onOpen(task.id)}
        className={cn(
          "min-w-0 flex-1 truncate text-left text-sm font-medium transition-colors hover:text-accent",
          isDone && "text-faint line-through"
        )}
      >
        {task.title}
      </button>

      <div className="flex shrink-0 items-center gap-3 text-xs text-faint">
        {task.project && (
          <span className="hidden items-center gap-1.5 sm:inline-flex">
            <span className="size-2 rounded-full" style={projectColorStyle(task.project.color)} aria-hidden />
            {task.project.name}
          </span>
        )}

        {task.estimate != null && (
          <span className="hidden items-center gap-1 md:inline-flex">
            <Timer className="size-3.5" strokeWidth={1.75} />
            {task.estimate}h
          </span>
        )}

        {blocked && !isDone && (
          <span
            className="inline-flex items-center gap-1 text-warning"
            title="Blocked by an open dependency"
          >
            <GitBranch className="size-3.5" strokeWidth={1.75} />
            Blocked
          </span>
        )}

        {task.due_date && (
          <span className={cn("inline-flex items-center gap-1", isOverdue && "text-danger font-medium")}>
            <CalendarDays className="size-3.5" strokeWidth={1.75} />
            {task.due_date}
            {isOverdue && <Badge variant="destructive" className="ml-1 px-1 py-0 text-[10px]">Overdue</Badge>}
          </span>
        )}
      </div>
    </div>
  );
}

function GroupToggle({
  value,
  onChange,
}: {
  value: "status" | "priority";
  onChange: (v: "status" | "priority") => void;
}) {
  return (
    <div className="flex items-center gap-1 text-xs">
      <span className="mr-1 text-faint">Group by:</span>
      {(["status", "priority"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            "rounded px-2 py-1 capitalize transition-colors",
            value === v
              ? "bg-accent-muted text-accent font-medium"
              : "text-secondary hover:text-foreground hover:bg-surface-hover"
          )}
        >
          {v}
        </button>
      ))}
    </div>
  );
}
