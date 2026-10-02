import { priorityColor } from "@/lib/task-meta";

export function UnscheduledStrip({
  tasks,
  onOpenTask,
  onOpenBoard,
}: {
  tasks: { id: string; title: string; priority: import("@/types/database").TaskPriority }[];
  onOpenTask: (id: string) => void;
  onOpenBoard: () => void;
}) {
  if (tasks.length === 0) return null;

  const MAX = 12;
  return (
    <div className="mt-3 shrink-0 rounded-lg border border-default bg-surface px-3 py-2">
      <div className="flex items-center gap-3">
        <p className="label-mono shrink-0">Unscheduled · {tasks.length}</p>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
          {tasks.slice(0, MAX).map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => onOpenTask(task.id)}
              title={task.title}
              className="inline-flex shrink-0 items-center gap-1.5 rounded border border-border-subtle bg-elevated px-2 py-1 text-xs text-secondary transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: priorityColor(task.priority) }}
                aria-hidden
              />
              <span className="max-w-40 truncate">{task.title}</span>
            </button>
          ))}
          {tasks.length > MAX ? (
            <button
              type="button"
              onClick={onOpenBoard}
              className="shrink-0 whitespace-nowrap rounded px-2 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent-muted/40"
            >
              + {tasks.length - MAX} more — open Tasks board
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}