"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";

import { TaskCard } from "@/components/task/TaskCard";
import { TASK_STATUS_META } from "@/lib/task-meta";
import { cn } from "@/lib/utils";
import type { TaskStatus, TaskWithProject } from "@/types/database";

interface KanbanColumnProps {
  status: TaskStatus;
  label: string;
  tasks: TaskWithProject[];
  onOpenTask: (id: string) => void;
  onAddTask: (status: TaskStatus) => void;
}

export function KanbanColumn({ status, label, tasks, onOpenTask, onAddTask }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${status}` });
  const statusColor =
    TASK_STATUS_META.find((s) => s.value === status)?.color ?? "var(--text-tertiary)";

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-xl border border-border-subtle bg-base/60 transition-colors duration-150",
        isOver && "border-accent/50 bg-accent-muted/20"
      )}
    >
      <div className="flex items-center gap-2 border-b border-border-subtle/70 px-3 py-2.5">
        <span
          className="size-2 rounded-full shadow-[0_0_8px_0_var(--border-default)]"
          style={{ backgroundColor: statusColor }}
          aria-hidden
        />
        <span className="text-xs font-semibold tracking-wide text-foreground">
          {label}
        </span>
        <span className="rounded-md bg-surface-hover px-1.5 py-0.5 font-mono text-[11px] font-medium text-secondary tabular-nums">
          {tasks.length}
        </span>
        <button
          type="button"
          onClick={() => onAddTask(status)}
          aria-label={`Add task to ${label}`}
          className="ml-auto rounded p-1 text-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <Plus className="size-4" strokeWidth={1.75} />
        </button>
      </div>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-2 px-3 pb-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onOpen={onOpenTask} />
          ))}

          {tasks.length === 0 && !isOver ? (
            <div className="rounded-lg border border-dashed border-border-subtle px-3 py-6 text-center text-xs text-faint">
              Drop tasks here
            </div>
          ) : null}
        </div>
      </SortableContext>
    </div>
  );
}
