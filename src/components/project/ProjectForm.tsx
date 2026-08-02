"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FolderKanban } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateProject, useUpdateProject, type ProjectInput } from "@/hooks/useProjects";
import { PROJECT_COLORS } from "@/lib/project-colors";
import { cn } from "@/lib/utils";
import type { Project, ProjectStatus } from "@/types/database";

interface ProjectFormProps {
  workspaceId: string;
  /** When provided, the dialog edits this project instead of creating. */
  project?: Project;
  trigger: React.ReactNode;
  onCreated?: (id: string) => void;
}

const STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Active",
  paused: "Paused",
  archived: "Archived",
};

export function ProjectForm({ workspaceId, project, trigger, onCreated }: ProjectFormProps) {
  const [open, setOpen] = useState(false);

  const createProject = useCreateProject(workspaceId);
  const updateProject = useUpdateProject(workspaceId);

  const submit = async (input: ProjectInput) => {
    if (project) {
      await updateProject.mutateAsync({ id: project.id, patch: input });
      toast.success("Project updated");
    } else {
      const created = await createProject.mutateAsync(input);
      toast.success("Project created");
      onCreated?.(created.id);
    }
    setOpen(false);
  };

  const isPending = createProject.isPending || updateProject.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderKanban className="size-4 text-accent" strokeWidth={1.75} />
            {project ? "Edit project" : "New project"}
          </DialogTitle>
          <DialogDescription>
            {project
              ? "Update this project's details."
              : "A body of work — notes, tasks, and resources live under it."}
          </DialogDescription>
        </DialogHeader>

        {/* Keyed by open state so fields reset fresh on every open. */}
        <ProjectFormFields
          key={open ? "open" : "closed"}
          project={project}
          submitting={isPending}
          onSubmit={submit}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function ProjectFormFields({
  project,
  submitting,
  onSubmit,
  onCancel,
}: {
  project?: Project;
  submitting: boolean;
  onSubmit: (input: ProjectInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [color, setColor] = useState<string>(project?.color ?? PROJECT_COLORS[0]);
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? "active");

  const submit = async () => {
    if (!name.trim()) return;
    await onSubmit({
      name: name.trim(),
      description: description || null,
      color,
      ...(project ? { status } : {}),
    });
  };

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="project-name">Name</Label>
          <Input
            id="project-name"
            placeholder="e.g. EngineerOS"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="project-description">Description</Label>
          <Textarea
            id="project-description"
            placeholder="What is this project about?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Color</Label>
          <div className="flex flex-wrap gap-2">
            {PROJECT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                onClick={() => setColor(c)}
                className={cn(
                  "size-6 rounded-full transition-transform duration-150 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                  color === c && "ring-2 ring-foreground ring-offset-2 ring-offset-popover"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {project ? (
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={() => void submit()} disabled={!name.trim() || submitting}>
          {submitting ? "Saving…" : project ? "Save changes" : "Create project"}
        </Button>
      </DialogFooter>
    </>
  );
}
