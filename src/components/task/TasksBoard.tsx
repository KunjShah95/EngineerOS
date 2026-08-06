"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckSquare, Kanban, List, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shell/PageHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KanbanBoard } from "@/components/task/KanbanBoard";
import { TaskListView } from "@/components/task/TaskListView";
import { TaskDetailPanel } from "@/components/task/TaskDetailPanel";
import { TaskForm } from "@/components/task/TaskForm";
import { useProjects } from "@/hooks/useProjects";
import { useTasksRealtime } from "@/hooks/useRealtime";
import { useWorkspace } from "@/hooks/useWorkspace";
import { PRIORITY_META } from "@/lib/task-meta";
import { cn } from "@/lib/utils";
import type { TaskPriority, TaskStatus } from "@/types/database";

type ViewMode = "kanban" | "list";

export function TasksBoard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: workspace } = useWorkspace();
  const workspaceId = workspace?.id ?? null;

  const { data: projects } = useProjects(workspaceId);
  useTasksRealtime(workspaceId);

  const projectFilter = searchParams.get("project") ?? "all";
  const priorityFilter = searchParams.get("priority") ?? "all";
  const openTaskId = searchParams.get("task");

  const [addStatus, setAddStatus] = useState<TaskStatus | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");

  // Deep link ?new=1 (⇧⌘N / command palette) — open the new-task form, then
  // clear the param so a refresh doesn't re-open it. The state adjustment
  // happens during render (React-recommended) and the effect only touches the
  // URL, so no cascading setState.
  const newTaskPending = searchParams.get("new") === "1";
  const [newTaskHandled, setNewTaskHandled] = useState(false);
  if (newTaskPending && !newTaskHandled) {
    setNewTaskHandled(true);
    setAddStatus("todo");
  } else if (!newTaskPending && newTaskHandled) {
    // Reset so a later ⇧⌘N press re-opens the form.
    setNewTaskHandled(false);
  }
  useEffect(() => {
    if (!newTaskPending) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("new");
    router.replace(`${pathname}?${params.toString()}`);
  }, [newTaskPending, searchParams, pathname, router]);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") params.delete(key);
    else params.set(key, value);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const openTask = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("task", id);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const closeTask = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("task");
    router.replace(`${pathname}?${params.toString()}`);
  };

  const filters = {
    projectId: projectFilter === "all" ? null : projectFilter,
    priority: (priorityFilter === "all" ? null : priorityFilter) as TaskPriority | null,
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-default px-6 py-4">
        <PageHeader
          icon={CheckSquare}
          title="Tasks"
          description={viewMode === "kanban" ? "Drag cards between columns to update status." : "All tasks in a flat list."}
          className="mb-0"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Select value={projectFilter} onValueChange={(v) => updateFilter("project", v)}>
                <SelectTrigger size="sm" aria-label="Filter by project" className="min-w-36">
                  <SelectValue placeholder="All projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All projects</SelectItem>
                  {(projects ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={(v) => updateFilter("priority", v)}>
                <SelectTrigger size="sm" aria-label="Filter by priority" className="min-w-32">
                  <SelectValue placeholder="All priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priorities</SelectItem>
                  {PRIORITY_META.filter((p) => p.value !== "none").map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <span className="capitalize">{p.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* View toggle */}
              <div className="flex items-center rounded-lg border border-default bg-surface p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode("kanban")}
                  aria-label="Kanban view"
                  className={cn(
                    "rounded-md p-1.5 transition-colors",
                    viewMode === "kanban"
                      ? "bg-accent-muted text-accent"
                      : "text-secondary hover:text-foreground"
                  )}
                >
                  <Kanban className="size-3.5" strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  aria-label="List view"
                  className={cn(
                    "rounded-md p-1.5 transition-colors",
                    viewMode === "list"
                      ? "bg-accent-muted text-accent"
                      : "text-secondary hover:text-foreground"
                  )}
                >
                  <List className="size-3.5" strokeWidth={1.75} />
                </button>
              </div>

              <Button size="sm" onClick={() => setAddStatus("todo")}>
                <Plus className="size-4" strokeWidth={1.75} />
                New Task
              </Button>
            </div>
          }
        />
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {viewMode === "kanban" ? (
          <KanbanBoard
            workspaceId={workspaceId ?? ""}
            filters={filters}
            onOpenTask={openTask}
            onAddTask={setAddStatus}
          />
        ) : (
          <TaskListView
            workspaceId={workspaceId ?? ""}
            filters={filters}
            onOpenTask={openTask}
          />
        )}
      </div>

      {openTaskId ? (
        <TaskDetailPanel
          key={openTaskId}
          workspaceId={workspaceId ?? ""}
          taskId={openTaskId}
          onClose={closeTask}
        />
      ) : null}

      <TaskForm
        workspaceId={workspaceId ?? ""}
        filters={filters}
        defaultStatus={addStatus ?? "todo"}
        open={addStatus !== null}
        onOpenChange={(o) => {
          if (!o) setAddStatus(null);
        }}
      />
    </div>
  );
}
