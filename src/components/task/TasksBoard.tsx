"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckSquare, Plus } from "lucide-react";

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
import { TaskDetailPanel } from "@/components/task/TaskDetailPanel";
import { TaskForm } from "@/components/task/TaskForm";
import { useProjects } from "@/hooks/useProjects";
import { useTasksRealtime } from "@/hooks/useRealtime";
import { useWorkspace } from "@/hooks/useWorkspace";
import { PRIORITY_META } from "@/lib/task-meta";
import type { TaskPriority, TaskStatus } from "@/types/database";

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

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-default px-6 py-4">
        <PageHeader
          icon={CheckSquare}
          title="Tasks"
          description="Drag cards between columns to update status."
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

              <Button size="sm" onClick={() => setAddStatus("todo")}>
                <Plus className="size-4" strokeWidth={1.75} />
                New Task
              </Button>
            </div>
          }
        />
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <KanbanBoard
          workspaceId={workspaceId ?? ""}
          filters={{
            projectId: projectFilter === "all" ? null : projectFilter,
            priority: (priorityFilter === "all" ? null : priorityFilter) as TaskPriority | null,
          }}
          onOpenTask={openTask}
          onAddTask={setAddStatus}
        />
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
        filters={{
          projectId: projectFilter === "all" ? null : projectFilter,
          priority: (priorityFilter === "all" ? null : priorityFilter) as TaskPriority | null,
        }}
        defaultStatus={addStatus ?? "todo"}
        open={addStatus !== null}
        onOpenChange={(o) => {
          if (!o) setAddStatus(null);
        }}
      />
    </div>
  );
}
