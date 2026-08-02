import Link from "next/link";

import { priorityColor } from "@/lib/task-meta";

export function UnscheduledStrip({ tasks }: { tasks: { id: string; title: string; priority: import("@/types/database").TaskPriority }[] }) {
  if (tasks.length === 0) return null;

  const MAX = 12;
  return (
    <div className="mt-4 rounded-lg border border-default bg-surface p-3">
      <p className="mb-2 text-xs font-medium text-faint">
        Unscheduled ({tasks.length})
      </p>
      <div className="flex flex-wrap gap-1.5">
        {tasks.slice(0, MAX).map((task) => (
          <span
            key={task.id}
            className="inline-flex items-center gap-1.5 rounded-md bg-elevated px-2 py-1 text-xs text-secondary"
          >
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: priorityColor(task.priority) }}
              aria-hidden
            />
            {task.title}
          </span>
        ))}
      </div>
      {tasks.length > MAX ? (
        <Link href="/tasks" className="mt-2 inline-block text-xs font-medium text-accent hover:text-accent-hover">
          + {tasks.length - MAX} more — see Tasks
        </Link>
      ) : null}
    </div>
  );
}