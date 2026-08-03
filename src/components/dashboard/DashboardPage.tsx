"use client";

import Link from "next/link";
import { format } from "date-fns";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  FileText,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  Pin,
  Plus,
  Zap,
} from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { PageLoader } from "@/components/shell/PageLoader";
import { PageHeader } from "@/components/shell/PageHeader";
import { useTasks } from "@/hooks/useTasks";
import { useMarkReminderRead, useReminders } from "@/hooks/useAutomation";
import { useNotes } from "@/hooks/useNotes";
import { useProjects } from "@/hooks/useProjects";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useUiStore } from "@/lib/store/ui";
import { PRIORITY_META, priorityColor } from "@/lib/task-meta";
import { projectColorStyle } from "@/lib/project-colors";
import { cn } from "@/lib/utils";
import type { TaskWithProject } from "@/types/database";

const PRIORITY_WEIGHT: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
};

export function DashboardPage() {
  const { data: workspace } = useWorkspace();
  const workspaceId = workspace?.id ?? null;
  const setQuickCaptureOpen = useUiStore((s) => s.setQuickCaptureOpen);

  const today = format(new Date(), "yyyy-MM-dd");

  const { data: todayTasks, isLoading: tasksLoading } = useTasks(workspaceId, {
    dueDate: today,
  });
  const { data: allTasks } = useTasks(workspaceId);
  const { data: notes, isLoading: notesLoading } = useNotes(workspaceId);
  const { data: projects, isLoading: projectsLoading } = useProjects(workspaceId);
  const { data: reminders } = useReminders(workspaceId);
  const markReminderRead = useMarkReminderRead(workspaceId);

  if (!workspace) return <PageLoader label="Loading dashboard…" />;

  const openTasks = (todayTasks ?? []).filter((t) => t.status !== "done");
  const focus = [...openTasks]
    .sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority])
    .slice(0, 3);

  const overdue = (allTasks ?? []).filter(
    (t) => t.status !== "done" && t.due_date && t.due_date < today
  );

  const unreadReminders = (reminders ?? []).filter((r) => !r.read_at);

  const recentNotes = (notes ?? []).slice(0, 5);
  const doneToday = (todayTasks ?? []).filter((t) => t.status === "done").length;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 5) return "Good night";
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  const progressByProject = new Map<string, { total: number; done: number }>();
  for (const t of allTasks ?? []) {
    if (!t.project_id) continue;
    const entry = progressByProject.get(t.project_id) ?? { total: 0, done: 0 };
    entry.total += 1;
    if (t.status === "done") entry.done += 1;
    progressByProject.set(t.project_id, entry);
  }

  const activity: { id: string; kind: "task" | "note"; title: string; at: string; href: string }[] = [
    ...(allTasks ?? []).map((t) => ({
      id: `task:${t.id}`,
      kind: "task" as const,
      title: t.title,
      at: t.updated_at,
      href: `/tasks?task=${t.id}`,
    })),
    ...(notes ?? []).map((n) => ({
      id: `note:${n.id}`,
      kind: "note" as const,
      title: n.title,
      at: n.updated_at,
      href: `/notes/${n.id}`,
    })),
  ]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 8);

  const isLoading = tasksLoading || notesLoading || projectsLoading;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-6xl space-y-8 p-6"
    >
      <PageHeader
        icon={LayoutDashboard}
        title={greeting}
        description={`${format(new Date(), "EEEE, MMMM d")} — here's what matters today.`}
        actions={
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={() => setQuickCaptureOpen(true)}
            className="group flex w-full max-w-md items-center gap-2 rounded-lg border border-default bg-surface px-3 py-2 text-sm text-secondary transition-colors duration-150 hover:border-border-subtle hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <Zap className="size-4 shrink-0 text-accent" strokeWidth={1.75} />
            <span className="flex-1 text-left">Quick capture something…</span>
            <Plus className="size-4 opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={1.75} />
          </motion.button>
        }
      />

      {isLoading ? (
        <div className="space-y-8">
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      ) : (
        <>
          {/* Stat strip */}
          <section aria-label="Overview" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              icon={CheckCircle2}
              label="Done today"
              value={`${doneToday}/${todayTasks?.length ?? 0}`}
              tone="text-success"
            />
            <StatCard
              icon={ListTodo}
              label="Due today"
              value={openTasks.length}
              tone="text-accent"
            />
            <StatCard
              icon={Bell}
              label="Reminders"
              value={unreadReminders.length}
              tone="text-warning"
            />
            <StatCard
              icon={FolderKanban}
              label="Projects"
              value={projects?.length ?? 0}
              tone="text-info"
            />
          </section>

          {overdue.length > 0 && (
            <section aria-label="Overdue">
              <SectionHeading title={`Overdue (${overdue.length})`} href="/tasks" />
              <div className="rounded-lg border border-danger/30 bg-danger/5 p-3">
                <div className="space-y-1">
                  {overdue.slice(0, 5).map((task) => (
                    <TaskRow key={task.id} task={task} overdue />
                  ))}
                </div>
              </div>
            </section>
          )}

          {unreadReminders.length > 0 && (
            <section aria-label="Reminders">
              <SectionHeading title={`Reminders (${unreadReminders.length})`} />
              <div className="space-y-1">
                {unreadReminders.slice(0, 5).map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 rounded-md border border-accent/30 bg-accent-muted/40 px-3 py-2.5 text-sm"
                  >
                    <Bell className="size-4 shrink-0 text-accent" strokeWidth={1.75} />
                    <Link
                      href={r.task_id ? `/tasks?task=${r.task_id}` : "/tasks"}
                      className="min-w-0 flex-1 truncate text-foreground transition-colors hover:text-accent"
                    >
                      {r.title}
                    </Link>
                    <span className="shrink-0 text-xs text-faint">
                      {new Date(r.fire_at).toLocaleString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => void markReminderRead.mutateAsync(r.id)}
                      aria-label="Mark reminder read"
                      className="shrink-0 rounded p-1 text-faint transition-colors hover:bg-surface-hover hover:text-accent"
                    >
                      <Check className="size-3.5" strokeWidth={1.75} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section aria-label="Today's focus">
            <SectionHeading title="Today's Focus" href={focus.length > 0 ? "/tasks" : undefined} />
            {focus.length === 0 ? (
              <EmptyCard
                icon={CheckCircle2}
                title="Nothing due today"
                description="Tasks with a due date of today will show up here."
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {focus.map((task) => (
                  <motion.div key={task.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Link
                      href={`/tasks?task=${task.id}`}
                      className="block rounded-lg border border-default bg-surface p-4 transition-colors duration-150 hover:bg-surface-hover"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <PriorityBadge priority={task.priority} />
                        <span className="text-xs text-faint">{task.due_date}</span>
                      </div>
                      <p className="line-clamp-2 text-sm font-medium">{task.title}</p>
                      {task.project ? (
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-secondary">
                          <span
                            className="size-2 rounded-full"
                            style={projectColorStyle(task.project.color)}
                            aria-hidden
                          />
                          {task.project.name}
                        </p>
                      ) : null}
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <section aria-label="Today's tasks">
              <SectionHeading title={`Today's Tasks (${doneToday}/${todayTasks?.length ?? 0})`} href="/tasks" />
              {(todayTasks ?? []).length === 0 ? (
                <EmptyCard
                  icon={CheckCircle2}
                  title="No tasks today"
                  description="Assign a due date to tasks to plan your day."
                />
              ) : (
                <div className="space-y-1">
                  {(todayTasks ?? []).map((task) => (
                    <TaskRow key={task.id} task={task} />
                  ))}
                </div>
              )}
            </section>

            <section aria-label="Recent notes">
              <SectionHeading title="Recent Notes" href="/notes" />
              {recentNotes.length === 0 ? (
                <EmptyCard
                  icon={FileText}
                  title="No notes yet"
                  description="Write your first markdown note to see it here."
                />
              ) : (
                <div className="space-y-1">
                  {recentNotes.map((note) => (
                    <motion.div key={note.id} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                      <Link
                        href={`/notes/${note.id}`}
                        className="flex items-center gap-3 rounded-md border border-default bg-surface px-3 py-2.5 text-sm transition-colors duration-150 hover:bg-surface-hover"
                      >
                        {note.pinned ? (
                          <Pin className="size-4 shrink-0 text-accent" strokeWidth={1.75} />
                        ) : (
                          <FileText className="size-4 shrink-0 text-secondary" strokeWidth={1.75} />
                        )}
                        <span className="min-w-0 flex-1 truncate">{note.title}</span>
                        <span className="shrink-0 text-xs text-faint">
                          {new Date(note.updated_at).toLocaleDateString()}
                        </span>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section aria-label="Project progress">
            <SectionHeading title="Project Progress" href="/projects" />
            {(projects ?? []).length === 0 ? (
              <EmptyCard
                icon={FolderKanban}
                title="No projects yet"
                description="Create a project to track its progress here."
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {(projects ?? []).slice(0, 6).map((project) => {
                  const entry = progressByProject.get(project.id) ?? { total: 0, done: 0 };
                  const total = entry.total;
                  const done = entry.done;
                  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                  return (
                    <motion.div key={project.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Link
                        href={`/projects/${project.id}`}
                        className="block rounded-lg border border-default bg-surface p-4 transition-colors duration-150 hover:bg-surface-hover"
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <span
                            className="size-2.5 rounded-full"
                            style={projectColorStyle(project.color)}
                            aria-hidden
                          />
                          <span className="min-w-0 truncate text-sm font-medium">
                            {project.name}
                          </span>
                          <span className="text-xs text-faint">
                            {done}/{total} · {pct}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: project.color ?? "var(--accent)",
                            }}
                          />
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>

          <section aria-label="Recent activity">
            <SectionHeading title="Recent Activity" />
            {activity.length === 0 ? (
              <EmptyCard
                icon={Zap}
                title="No activity yet"
                description="Changes to your tasks and notes will show up here."
              />
            ) : (
              <div className="overflow-hidden rounded-lg border border-default">
                {activity.map((item, i) => (
                  <motion.div
                    key={item.id}
                    whileHover={{ x: 4 }}
                    className={cn(
                      "flex items-center gap-3 bg-surface px-4 py-2.5 text-sm transition-colors duration-150 hover:bg-surface-hover",
                      i > 0 && "border-t border-border-subtle"
                    )}
                  >
                    <Link href={item.href} className="flex w-full items-center gap-3">
                      {item.kind === "task" ? (
                        <CheckCircle2 className="size-4 shrink-0 text-accent" strokeWidth={1.75} />
                      ) : (
                        <FileText className="size-4 shrink-0 text-secondary" strokeWidth={1.75} />
                      )}
                      <span className="min-w-0 flex-1 truncate">{item.title}</span>
                      <span className="shrink-0 text-xs text-faint">
                        {item.kind === "task" ? "Task" : "Note"} ·{" "}
                        {new Date(item.at).toLocaleDateString()}
                      </span>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </motion.div>
  );
}

function SectionHeading({ title, href }: { title: string; href?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
      {href ? (
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-xs font-medium text-accent transition-colors hover:text-accent-hover"
        >
          View all
          <ArrowRight className="size-3" strokeWidth={1.75} />
        </Link>
      ) : null}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string | number;
  tone: string;
}) {
  return (
    <div className="group rounded-xl border border-default bg-surface p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-elevated">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-secondary">{label}</p>
        <Icon
          className={cn("size-4 shrink-0 transition-transform duration-200 group-hover:scale-110", tone)}
          strokeWidth={1.75}
        />
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground tabular-nums">
        {value}
      </p>
    </div>
  );
}

function EmptyCard({ icon: Icon, title, description }: { icon: typeof FileText; title: string; description: string }) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-dashed border-border-subtle bg-surface/50 px-4 py-6">
      <div className="rounded-md bg-accent-muted p-2.5">
        <Icon className="size-5 text-accent" strokeWidth={1.75} />
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-secondary">{description}</p>
      </div>
    </div>
  );
}

function TaskRow({ task, overdue }: { task: TaskWithProject; overdue?: boolean }) {
  return (
    <Link
      href={`/tasks?task=${task.id}`}
      className="flex items-center gap-3 rounded-md border border-default bg-surface px-3 py-2.5 text-sm transition-colors duration-150 hover:bg-surface-hover"
    >
      <span
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: priorityColor(task.priority) }}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate">{task.title}</span>
      {overdue ? (
        <span className="shrink-0 text-xs text-danger">Overdue · {task.due_date}</span>
      ) : task.status === "done" ? (
        <span className="shrink-0 text-xs text-success">Done</span>
      ) : (
        <span className="shrink-0 text-xs text-faint capitalize">{task.status.replace("_", " ")}</span>
      )}
    </Link>
  );
}

function PriorityBadge({ priority }: { priority: TaskWithProject["priority"] }) {
  const meta = PRIORITY_META.find((p) => p.value === priority);
  if (!meta || priority === "none") return null;
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[11px] font-medium capitalize"
      style={{ backgroundColor: meta.color, color: "#fff" }}
    >                    {meta.label}
    </span>
  );
}
