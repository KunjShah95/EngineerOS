"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { CheckSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateTask, type CreateTaskInput, type TaskFilters } from "@/hooks/useTasks";
import { useProjects } from "@/hooks/useProjects";
import { PRIORITY_META, TASK_STATUS_META } from "@/lib/task-meta";
import type { Project, TaskPriority, TaskStatus } from "@/types/database";

interface TaskFormProps {
  workspaceId: string;
  filters?: TaskFilters | null;
  defaultStatus?: TaskStatus;
  trigger?: React.ReactNode;
  /** Controlled open state — used by the kanban column "+" buttons. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function TaskForm({
  workspaceId,
  filters,
  defaultStatus,
  trigger,
  open,
  onOpenChange,
}: TaskFormProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = (next: boolean) => {
    setInternalOpen(next);
    onOpenChange?.(next);
  };

  const { data: projects } = useProjects(workspaceId);
  const createTask = useCreateTask(workspaceId, filters);

  const submit = async (input: CreateTaskInput) => {
    await createTask.mutateAsync(input);
    toast.success("Task created");
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckSquare className="size-4 text-accent" strokeWidth={1.75} />
            New task
          </DialogTitle>
          <DialogDescription>Add a task to the board.</DialogDescription>
        </DialogHeader>

        {/* Keyed by open state: the dialog content unmounts on close, so fields
            reset fresh on every open. */}
        <TaskFormFields
          key={isOpen ? "open" : "closed"}
          defaultStatus={defaultStatus ?? "todo"}
          projects={projects ?? []}
          submitting={createTask.isPending}
          onSubmit={submit}
          onCancel={() => setIsOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function TaskFormFields({
  defaultStatus,
  projects,
  submitting,
  onSubmit,
  onCancel,
}: {
  defaultStatus: TaskStatus;
  projects: Project[];
  submitting: boolean;
  onSubmit: (input: CreateTaskInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<TaskStatus>(defaultStatus);
  const [priority, setPriority] = useState<TaskPriority>("none");
  const [projectId, setProjectId] = useState<string>("none");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [estimate, setEstimate] = useState("");

  const inFlight = useRef(false);

  const submit = async () => {
    if (!title.trim() || inFlight.current) return;
    inFlight.current = true;
    try {
      await onSubmit({
        title: title.trim(),
        status,
        priority,
        project_id: projectId === "none" ? null : projectId,
        due_date: dueDate || null,
        due_time: dueTime || null,
        estimate: estimate ? Number(estimate) : null,
      });
    } finally {
      inFlight.current = false;
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="task-title">Title</Label>
          <Input
            id="task-title"
            placeholder="What needs to be done?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_STATUS_META.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_META.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <span className="capitalize">{p.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-estimate">Estimate (hrs)</Label>
            <Input
              id="task-estimate"
              type="number"
              min={0}
              step={0.5}
              placeholder="—"
              value={estimate}
              onChange={(e) => setEstimate(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="task-due">Due date</Label>
            <Input
              id="task-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-time">Start time</Label>
            <Input
              id="task-time"
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
            />
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={() => void submit()} disabled={!title.trim() || submitting}>
          {submitting ? "Creating…" : "Create task"}
        </Button>
      </DialogFooter>
    </>
  );
}
