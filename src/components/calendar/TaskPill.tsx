import Link from "next/link";

import { priorityColor } from "@/lib/task-meta";
import { cn } from "@/lib/utils";
import type { TaskWithProject } from "@/types/database";

export function TaskPill({ task }: { task: TaskWithProject }) {
  return (
    <Link
      href={`/tasks?task=${task.id}`}
      className={cn(
        "group flex min-w-0 items-center gap-1.5 rounded-md border border-border-subtle bg-elevated px-2 py-1 text-xs text-foreground transition-colors duration-150 hover:bg-surface-hover",
        task.status === "done" && "opacity-50"
      )}
    >
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: priorityColor(task.priority) }}
        aria-hidden
      />
      <span className={cn("line-clamp-1 min-w-0", task.status === "done" && "line-through")}>
        {task.title}
      </span>
    </Link>
  );
}