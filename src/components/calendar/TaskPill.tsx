import Link from "next/link";

import { priorityColor } from "@/lib/task-meta";
import { cn } from "@/lib/utils";
import type { TaskWithProject } from "@/types/database";

export function TaskPill({ task }: { task: TaskWithProject }) {
  return (
    <Link
      href={`/tasks?task=${task.id}`}
      className={cn(
        "group flex h-[22px] w-full min-w-0 items-center gap-1.5 rounded-[4px] bg-elevated px-1.5 text-[11px] leading-none text-foreground ring-1 ring-inset ring-border-subtle transition-colors duration-150 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
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