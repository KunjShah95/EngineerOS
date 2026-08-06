"use client";

import Link from "next/link";
import { format } from "date-fns";
import { Brain, FileText, GitBranch, ListTodo, Sunrise } from "lucide-react";

import { useBlockedTaskIds, useTasks } from "@/hooks/useTasks";
import { useOpenTaskNotes } from "@/hooks/useMemoryContext";
import { useNotes } from "@/hooks/useNotes";
import { cn } from "@/lib/utils";

interface MemoryItem {
  id: string;
  label: string;
  sub?: string;
  href: string;
  tone: "default" | "warning";
}

interface MemoryColumn {
  id: string;
  icon: typeof FileText;
  title: string;
  empty: string;
  items: MemoryItem[];
  foot?: string;
}

/**
 * The AI Memory Layer — context, not chat. Shows what the assistant already
 * knows about the user's work: yesterday's output, tasks in flight, what's
 * blocked, and notes tied to open tasks. Renders on the dashboard and above
 * the assistant's empty chat so conversations start with real context.
 *
 * `compact` switches the grid to two columns for narrower surfaces (the chat).
 */
export function MemoryPanel({
  workspaceId,
  compact = false,
}: {
  workspaceId: string;
  compact?: boolean;
}) {
  const { data: allTasks } = useTasks(workspaceId);
  const { data: notes } = useNotes(workspaceId);
  const { data: blockedIds } = useBlockedTaskIds(workspaceId);
  const { data: openTaskNotes } = useOpenTaskNotes(workspaceId);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = format(yesterday, "yyyy-MM-dd");

  const doneYesterday = (allTasks ?? []).filter(
    (t) => t.status === "done" && (t.completed_at ?? "").startsWith(yesterdayStr)
  );
  const notesYesterday = (notes ?? []).filter((n) =>
    (n.updated_at ?? "").startsWith(yesterdayStr)
  );
  const inFlight = (allTasks ?? []).filter((t) => t.status === "in_progress");
  const blockedTasks = (allTasks ?? []).filter(
    (t) => t.status !== "done" && (blockedIds?.has(t.id) ?? false)
  );

  const hasMemory =
    doneYesterday.length > 0 ||
    notesYesterday.length > 0 ||
    inFlight.length > 0 ||
    blockedTasks.length > 0 ||
    (openTaskNotes ?? []).length > 0;

  const columns: MemoryColumn[] = [
    {
      id: "yesterday",
      icon: Sunrise,
      title: "Yesterday",
      empty: "Quiet day",
      foot:
        doneYesterday.length + notesYesterday.length > 6
          ? `${doneYesterday.length + notesYesterday.length} items`
          : undefined,
      items: [
        ...doneYesterday.slice(0, 3).map((t) => ({
          id: `done:${t.id}`,
          label: t.title,
          href: `/tasks?task=${t.id}`,
          tone: "default" as const,
        })),
        ...notesYesterday.slice(0, 3).map((n) => ({
          id: `note:${n.id}`,
          label: n.title,
          href: `/notes/${n.id}`,
          tone: "default" as const,
        })),
      ],
    },
    {
      id: "inflight",
      icon: ListTodo,
      title: "In flight",
      empty: "Nothing in progress",
      items: inFlight.slice(0, 6).map((t) => ({
        id: t.id,
        label: t.title,
        href: `/tasks?task=${t.id}`,
        tone: "default" as const,
      })),
    },
    {
      id: "blocked",
      icon: GitBranch,
      title: "Blocked",
      empty: "Nothing blocked",
      items: blockedTasks.slice(0, 6).map((t) => ({
        id: t.id,
        label: t.title,
        href: `/tasks?task=${t.id}`,
        tone: "warning" as const,
      })),
    },
    {
      id: "linked",
      icon: FileText,
      title: "Notes on open tasks",
      empty: "No linked notes",
      items: (openTaskNotes ?? []).slice(0, 6).map((r) => ({
        id: r.note_id,
        label: r.note_title,
        sub: r.task_title,
        href: `/notes/${r.note_id}`,
        tone: "default" as const,
      })),
    },
  ];

  return (
    <section aria-label="Memory">
      <div className={cn("rounded-lg border border-border-subtle bg-surface", compact ? "p-4" : "p-5")}>
        <div className={cn("flex items-center justify-between gap-3", compact ? "mb-3" : "mb-4")}>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
            <Brain className="size-3.5 text-accent" strokeWidth={1.75} />
            Memory
          </p>
          <span className="text-[11px] text-faint">What I know about your work</span>
        </div>

        {!hasMemory ? (
          <p className="text-sm text-faint">
            Nothing to remember yet — complete tasks, write notes, and mark work in progress.
          </p>
        ) : (
          <div
            className={cn(
              "grid gap-5",
              compact ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-4"
            )}
          >
            {columns.map((col) => (
              <MemoryBlock key={col.id} {...col} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function MemoryBlock({
  icon: Icon,
  title,
  empty,
  items,
  foot,
}: MemoryColumn) {
  return (
    <div className="min-w-0">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
        <Icon className="size-3.5" strokeWidth={1.75} />
        {title}
        {foot ? <span className="normal-case">· {foot}</span> : null}
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-faint">{empty}</p>
      ) : (
        <div className="space-y-1">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex min-w-0 items-baseline gap-2 rounded-md px-2 py-1 text-sm transition-colors duration-150 hover:bg-surface-hover",
                item.tone === "warning" ? "text-warning" : "text-foreground"
              )}
            >
              <span
                className={cn(
                  "size-1.5 shrink-0 translate-y-[-2px] rounded-full",
                  item.tone === "warning" ? "bg-warning" : "bg-accent"
                )}
                aria-hidden
              />
              <span className="min-w-0 truncate">{item.label}</span>
              {item.sub ? (
                <span className="shrink-0 truncate text-[11px] text-faint">↳ {item.sub}</span>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
