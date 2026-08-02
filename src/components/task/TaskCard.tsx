"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, Timer } from "lucide-react";

import { priorityColor } from "@/lib/task-meta";
import { projectColorStyle } from "@/lib/project-colors";
import { cn } from "@/lib/utils";
import type { TaskWithProject } from "@/types/database";

interface TaskCardProps {
  task: TaskWithProject;
  onOpen: (id: string) => void;
}

export function TaskCard({ task, onOpen }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { status: task.status } });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(task.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(task.id);
      }}
      className={cn(
        "group cursor-grab touch-none rounded-lg border border-default bg-surface p-3 shadow-sm transition-colors duration-150",
        "hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        "active:cursor-grabbing",
        task.status === "done" && "opacity-70"
      )}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : undefined,
        zIndex: isDragging ? 10 : undefined,
        borderLeft: `3px solid ${priorityColor(task.priority)}`,
      }}
    >
      <p
        className={cn(
          "line-clamp-2 text-sm font-medium leading-snug text-foreground",
          task.status === "done" && "text-faint line-through"
        )}
      >
        {task.title}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-faint">
        {task.project ? (
          <span className="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 font-medium text-secondary">
            <span
              className="size-2 rounded-full"
              style={projectColorStyle(task.project.color)}
              aria-hidden
            />
            {task.project.name}
          </span>
        ) : null}

        {task.due_date ? (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3.5" strokeWidth={1.75} />
            {task.due_date}
          </span>
        ) : null}

        {task.estimate != null ? (
          <span className="inline-flex items-center gap-1">
            <Timer className="size-3.5" strokeWidth={1.75} />
            {task.estimate}h
          </span>
        ) : null}
      </div>
    </div>
  );
}
