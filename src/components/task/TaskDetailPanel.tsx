"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  CheckSquare,
  FileText,
  Loader2,
  Link2,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDeleteTask,
  useLinkNoteToTask,
  useTask,
  useTaskLinkedNotes,
  useUnlinkNoteFromTask,
  useUpdateTask,
} from "@/hooks/useTasks";
import { useNotes } from "@/hooks/useNotes";
import { useProjects } from "@/hooks/useProjects";
import { PRIORITY_META, TASK_STATUS_META } from "@/lib/task-meta";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";
import { useSyncedState } from "@/lib/use-synced-state";
import type { TaskPriority, TaskStatus } from "@/types/database";

interface TaskDetailPanelProps {
  workspaceId: string;
  taskId: string;
  onClose: () => void;
}

export function TaskDetailPanel({ workspaceId, taskId, onClose }: TaskDetailPanelProps) {
  const { data: task, isLoading } = useTask(taskId);
  const updateTask = useUpdateTask(workspaceId);
  const deleteTask = useDeleteTask(workspaceId);

  const { data: projects } = useProjects(workspaceId);
  const { data: notes } = useNotes(workspaceId);
  const { data: linkedNotes } = useTaskLinkedNotes(taskId);
  const linkNote = useLinkNoteToTask(taskId);
  const unlinkNote = useUnlinkNoteFromTask(taskId);

  const [title, setTitle] = useSyncedState(task?.title ?? "");
  const [description, setDescription] = useSyncedState(task?.description ?? "");
  const [noteToAdd, setNoteToAdd] = useState<string>("none");
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (justSaved) {
      const t = setTimeout(() => setJustSaved(false), 1500);
      return () => clearTimeout(t);
    }
  }, [justSaved]);

  const saveTitle = useDebouncedCallback((value: string) => {
    updateTask.mutate(
      { id: taskId, patch: { title: value } },
      { onSuccess: () => setJustSaved(true) }
    );
  }, 600);

  const saveDescription = useDebouncedCallback((value: string) => {
    updateTask.mutate(
      { id: taskId, patch: { description: value || null } },
      { onSuccess: () => setJustSaved(true) }
    );
  }, 600);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-40">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
        <div className="absolute top-0 right-0 h-full w-[420px] max-w-full border-l border-default bg-popover p-6">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="mt-6 h-6 w-1/2" />
          <Skeleton className="mt-3 h-6 w-1/3" />
          <Skeleton className="mt-8 h-40 w-full" />
        </div>
      </div>
    );
  }

  if (!task) {
    return null;
  }

  const patch = (p: Parameters<typeof updateTask.mutate>[0]["patch"]) =>
    updateTask.mutate({ id: taskId, patch: p }, { onSuccess: () => setJustSaved(true) });

  const handleDelete = async () => {
    await deleteTask.mutateAsync(taskId);
    toast.success("Task deleted");
    onClose();
  };

  const addLinkedNote = async (noteId: string) => {
    await linkNote.mutateAsync(noteId);
    setNoteToAdd("none");
    toast.success("Note linked");
  };

  const availableNotes = (notes ?? []).filter(
    (n) => !(linkedNotes ?? []).some((ln) => ln.note_id === n.id)
  );

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Task details"
        className="absolute top-0 right-0 flex h-full w-[440px] max-w-full flex-col border-l border-default bg-popover shadow-xl data-open:animate-in data-open:slide-in-from-right-4"
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium tracking-wide text-secondary uppercase">
            <CheckSquare className="size-4" strokeWidth={1.75} />
            Task
            {updateTask.isPending || justSaved ? (
              <span className="ml-1 inline-flex items-center gap-1 normal-case text-faint">
                {updateTask.isPending ? (
                  <Loader2 className="size-3 animate-spin" strokeWidth={1.75} />
                ) : (
                  <Check className="size-3 text-success" strokeWidth={1.75} />
                )}
                {updateTask.isPending ? "Saving…" : "Saved"}
              </span>
            ) : null}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close task details"
            className="rounded-md p-1 text-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div className="space-y-1.5">
            <Label htmlFor="task-panel-title">Title</Label>
            <Input
              id="task-panel-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                saveTitle(e.target.value);
              }}
              onBlur={() =>
                updateTask.mutate(
                  { id: taskId, patch: { title } },
                  { onSuccess: () => setJustSaved(true) }
                )
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={task.status}
                onValueChange={(v) => patch({ status: v as TaskStatus })}
              >
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
              <Select
                value={task.priority}
                onValueChange={(v) => patch({ priority: v as TaskPriority })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_META.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: p.color }}
                          aria-hidden
                        />
                        <span className="capitalize">{p.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Project</Label>
              <Select
                value={task.project_id ?? "none"}
                onValueChange={(v) => patch({ project_id: v === "none" ? null : v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(projects ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-panel-due">Due date</Label>
              <Input
                id="task-panel-due"
                type="date"
                value={task.due_date ?? ""}
                onChange={(e) => patch({ due_date: e.target.value || null })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-panel-estimate">Estimate (hours)</Label>
            <Input
              id="task-panel-estimate"
              type="number"
              min={0}
              step={0.5}
              value={task.estimate ?? ""}
              onChange={(e) =>
                patch({
                  estimate: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-panel-desc">Description (markdown)</Label>
            <Textarea
              id="task-panel-desc"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                saveDescription(e.target.value);
              }}
              onBlur={() =>
                updateTask.mutate(
                  { id: taskId, patch: { description: description || null } },
                  { onSuccess: () => setJustSaved(true) }
                )
              }
              rows={5}
              placeholder="Add context, links, or notes…"
            />
          </div>

          <div className="space-y-2">
            <Label className="inline-flex items-center gap-1.5">
              <Link2 className="size-4" strokeWidth={1.75} />
              Linked notes
            </Label>

            {(linkedNotes ?? []).length === 0 ? (
              <p className="text-sm text-faint">No linked notes yet.</p>
            ) : (
              <div className="space-y-1">
                {(linkedNotes ?? []).map((ln) => (
                  <div
                    key={ln.note_id}
                    className="flex items-center justify-between rounded-md border border-border-subtle bg-surface px-3 py-2 text-sm"
                  >
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <FileText className="size-4 shrink-0 text-secondary" strokeWidth={1.75} />
                      <span className="truncate">{ln.note.title}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => unlinkNote.mutateAsync(ln.note_id)}
                      aria-label={`Unlink ${ln.note.title}`}
                      className="rounded p-1 text-faint transition-colors hover:bg-surface-hover hover:text-danger"
                    >
                      <X className="size-3.5" strokeWidth={1.75} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {availableNotes.length > 0 ? (
              <div className="flex items-center gap-2">
                <Select value={noteToAdd} onValueChange={(v) => void addLinkedNote(v)}>
                  <SelectTrigger className="w-full" aria-label="Link a note">
                    <SelectValue placeholder="Link a note…" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableNotes.map((n) => (
                      <SelectItem key={n.id} value={n.id}>
                        {n.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Add linked note"
                  disabled={noteToAdd === "none"}
                  onClick={() => void addLinkedNote(noteToAdd)}
                >
                  <Plus className="size-4" strokeWidth={1.75} />
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="border-t border-border-subtle px-5 py-4">
          <Button
            variant="ghost"
            className="w-full text-danger hover:bg-danger/10 hover:text-danger"
            onClick={() => void handleDelete()}
          >
            <Trash2 className="size-4" strokeWidth={1.75} />
            Delete task
          </Button>
        </div>
      </div>
    </div>
  );
}
