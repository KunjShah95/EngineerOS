"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CheckSquare,
  FileText,
  FolderKanban,
  Link2,
  MoreHorizontal,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shell/EmptyState";
import { ProjectForm } from "@/components/project/ProjectForm";
import { useDeleteProject, useProjects, useUpdateProject } from "@/hooks/useProjects";
import { useNotes } from "@/hooks/useNotes";
import { useTasks } from "@/hooks/useTasks";
import { useWorkspace } from "@/hooks/useWorkspace";
import { projectColorStyle } from "@/lib/project-colors";
import { cn } from "@/lib/utils";
import type { ProjectStatus, TaskPriority } from "@/types/database";

const TABS = ["overview", "notes", "tasks", "timeline", "resources"] as const;
type Tab = (typeof TABS)[number];

const statusStyles: Record<ProjectStatus, string> = {
  active: "bg-success/10 text-success",
  paused: "bg-warning/10 text-warning",
  archived: "bg-muted text-secondary",
};

const priorityColors: Record<TaskPriority, string> = {
  urgent: "text-danger",
  high: "text-warning",
  medium: "text-warning",
  low: "text-info",
  none: "text-faint",
};

export function ProjectPage({ projectId }: { projectId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: workspace } = useWorkspace();
  const workspaceId = workspace?.id ?? null;

  const projectQuery = useProjects(workspaceId);
  const { data: notes } = useNotes(workspaceId, { projectId });
  const { data: tasks } = useTasks(workspaceId, { projectId });
  const deleteProject = useDeleteProject(workspaceId);
  const updateProject = useUpdateProject(workspaceId);

  const activeProject = projectQuery.data?.find((p) => p.id === projectId);
  const isLoading = projectQuery.isLoading || !workspace;
  const isError = projectQuery.isError;

  const tab: Tab = (TABS as readonly string[]).includes(searchParams.get("tab") ?? "")
    ? (searchParams.get("tab") as Tab)
    : "overview";

  const setTab = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.replace(`${pathname}?${params.toString()}`);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <Skeleton className="mb-6 h-7 w-48" />
        <Skeleton className="h-10 w-full" />
        <div className="mt-6 space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (isError || !activeProject) {
    return (
      <div className="p-6">
        <EmptyState
          icon={FolderKanban}
          title="Project not found"
          description="It may have been archived or the link is wrong."
        />
      </div>
    );
  }

  const taskCount = activeProject.tasks[0]?.count ?? 0;
  const noteCount = activeProject.notes[0]?.count ?? 0;
  const doneCount = (tasks ?? []).filter((t) => t.status === "done").length;
  const progress = taskCount > 0 ? Math.round((doneCount / taskCount) * 100) : 0;

  const datedTasks = (tasks ?? [])
    .filter((t) => t.due_date)
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));

  const archiveProject = async () => {
    await updateProject.mutateAsync({ id: projectId, patch: { status: "archived" } });
    toast.success("Project archived");
  };

  const deleteProjectPermanently = async () => {
    await deleteProject.mutateAsync(projectId);
    toast.success("Project deleted");
    router.push("/projects");
  };

  return (
    <div className="p-6">
      <div className="mb-4">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-sm text-secondary transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" strokeWidth={1.75} />
          Projects
        </Link>
      </div>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="mt-1.5 size-3 shrink-0 rounded-full"
            style={projectColorStyle(activeProject.color)}
            aria-hidden
          />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold">{activeProject.name}</h1>
            {activeProject.description ? (
              <p className="mt-1 max-w-xl text-sm text-secondary">{activeProject.description}</p>
            ) : (
              <p className="mt-1 text-sm text-faint">No description yet.</p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Badge
            variant="outline"
            className={cn("border-transparent", statusStyles[activeProject.status])}
          >
            {activeProject.status}
          </Badge>

          <ProjectForm
            workspaceId={workspace.id}
            project={activeProject}
            trigger={
              <Button variant="ghost" size="icon" aria-label="Edit project">
                <Pencil className="size-4" strokeWidth={1.75} />
              </Button>
            }
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Project actions">
                <MoreHorizontal className="size-4" strokeWidth={1.75} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {activeProject.status !== "archived" ? (
                <DropdownMenuItem onSelect={() => void archiveProject()}>
                  Archive project
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => updateProject.mutate({ id: projectId, patch: { status: "active" } }, { onSuccess: () => toast.success("Project restored") })}>
                  Restore project
                </DropdownMenuItem>
              )}
              <DropdownMenuItem variant="destructive" onSelect={() => void deleteProjectPermanently()}>
                Delete project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-2">
        <TabsList variant="line">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="notes">Notes ({noteCount})</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({taskCount})</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard label="Notes" value={noteCount} icon={FileText} />
            <StatCard label="Tasks" value={taskCount} icon={CheckSquare} />
            <StatCard label="Done" value={`${doneCount} · ${progress}%`} icon={CalendarClock} />
          </div>

          <div className="mt-6">
            <h3 className="mb-3 text-sm font-medium text-secondary">Recent notes</h3>
            {(notes ?? []).length === 0 ? (
              <p className="text-sm text-faint">No notes in this project yet.</p>
            ) : (
              <div className="space-y-1">
                {(notes ?? []).slice(0, 5).map((note) => (
                  <Link
                    key={note.id}
                    href={`/notes/${note.id}`}
                    className="flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors duration-150 hover:bg-surface-hover"
                  >
                    <span className="truncate font-medium">{note.title}</span>
                    <span className="ml-4 shrink-0 text-xs text-faint">
                      {new Date(note.updated_at).toLocaleDateString()}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="notes" className="mt-6">
          {(notes ?? []).length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No notes yet"
              description="Notes written in this project will appear here."
            />
          ) : (
            <div className="space-y-1">
              {(notes ?? []).map((note) => (
                <Link
                  key={note.id}
                  href={`/notes/${note.id}`}
                  className="flex items-center justify-between rounded-md border border-default bg-surface px-4 py-3 text-sm transition-colors duration-150 hover:bg-surface-hover"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <FileText className="size-4 shrink-0 text-secondary" strokeWidth={1.75} />
                    <span className="truncate font-medium">{note.title}</span>
                    {note.pinned ? (
                      <Badge variant="outline" className="border-transparent bg-accent-muted text-accent">
                        Pinned
                      </Badge>
                    ) : null}
                  </div>
                  <span className="ml-4 shrink-0 text-xs text-faint">
                    {new Date(note.updated_at).toLocaleDateString()}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tasks" className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-secondary">
              {taskCount} {taskCount === 1 ? "task" : "tasks"}
            </p>
            <Link
              href={`/tasks?project=${projectId}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-colors hover:text-accent-hover"
            >
              <Link2 className="size-4" strokeWidth={1.75} />
              Open on board
            </Link>
          </div>
          {(tasks ?? []).length === 0 ? (
            <EmptyState
              icon={CheckSquare}
              title="No tasks yet"
              description="Tasks in this project will appear here and on the kanban board."
            />
          ) : (
            <div className="space-y-1">
              {(tasks ?? []).map((task) => (
                <Link
                  key={task.id}
                  href={`/tasks?task=${task.id}`}
                  className="flex items-center justify-between rounded-md border border-default bg-surface px-4 py-3 text-sm transition-colors duration-150 hover:bg-surface-hover"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        task.status === "done" ? "bg-success" : "bg-secondary"
                      )}
                      aria-hidden
                    />
                    <span
                      className={cn("truncate", task.status === "done" && "text-faint line-through")}
                    >
                      {task.title}
                    </span>
                  </div>
                  <div className="ml-4 flex shrink-0 items-center gap-3 text-xs">
                    {task.priority !== "none" ? (
                      <span className={cn("font-medium capitalize", priorityColors[task.priority])}>
                        {task.priority.replace("_", " ")}
                      </span>
                    ) : null}
                    {task.due_date ? <span className="text-faint">{task.due_date}</span> : null}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="timeline" className="mt-6">
          {datedTasks.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="No dated tasks"
              description="Tasks with a due date will form this project's timeline."
            />
          ) : (
            <div className="relative space-y-4 border-l border-border-subtle pl-6">
              {datedTasks.map((task) => (
                <div key={task.id} className="relative">
                  <span
                    className="absolute -left-[31px] top-1 size-2.5 rounded-full border-2 border-base"
                    style={{ backgroundColor: activeProject.color ?? "var(--accent)" }}
                    aria-hidden
                  />
                  <Link href={`/tasks?task=${task.id}`} className="block transition-colors hover:text-accent">
                    <p className="text-sm font-medium">{task.title}</p>
                    <p className="text-xs text-faint">
                      Due {task.due_date} · {task.status.replace("_", " ")}
                    </p>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="resources" className="mt-6">
          <EmptyState
            icon={Link2}
            title="Resources coming soon"
            description="Bookmarks, links, and files for this project will live here."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: typeof FileText;
}) {
  return (
    <div className="rounded-lg border border-default bg-surface p-4">
      <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-secondary uppercase">
        <Icon className="size-4" strokeWidth={1.75} />
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
