"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  CheckSquare,
  Circle,
  Clock,
  Copy,
  FileText,
  Link2,
  ListChecks,
  MessageCircle,
  Plus,
  Save,
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
import { Badge } from "@/components/ui/badge";
import {
  useCreateTask,
  useCreateTaskComment,
  useDeleteTask,
  useDeleteTaskComment,
  useLinkNoteToTask,
  useTask,
  useTaskComments,
  useTaskLinkedNotes,
  useUnlinkNoteFromTask,
  useUpdateTask,
} from "@/hooks/useTasks";
import { useNotes } from "@/hooks/useNotes";
import { useProjects } from "@/hooks/useProjects";
import { PRIORITY_META, TASK_STATUS_META } from "@/lib/task-meta";
import { useSyncedState } from "@/lib/use-synced-state";
import { cn } from "@/lib/utils";
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
  const createTask = useCreateTask(workspaceId);

  const { data: projects } = useProjects(workspaceId);
  const { data: notes } = useNotes(workspaceId);
  const { data: linkedNotes } = useTaskLinkedNotes(taskId);
  const linkNote = useLinkNoteToTask(taskId);
  const unlinkNote = useUnlinkNoteFromTask(taskId);

  const { data: comments } = useTaskComments(taskId);
  const createComment = useCreateTaskComment(taskId, workspaceId);
  const deleteComment = useDeleteTaskComment(taskId);

  const [title, setTitle] = useSyncedState(task?.title ?? "");
  const [description, setDescription] = useSyncedState(task?.description ?? "");
  const [noteToAdd, setNoteToAdd] = useState<string>("none");
  const [newSubtask, setNewSubtask] = useState("");
  const [newComment, setNewComment] = useState("");
  const [logHours, setLogHours] = useState("");

  // Escape key to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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

  if (!task) return null;

  const today = new Date().toISOString().split("T")[0];
  const isOverdue = task.due_date && task.due_date < today && task.status !== "done";
  const isDone = task.status === "done";

  const patch = (p: Parameters<typeof updateTask.mutate>[0]["patch"]) =>
    updateTask.mutate(
      { id: taskId, patch: p },
      { onSuccess: () => toast.success("Task updated") }
    );

  const handleSave = () => {
    updateTask.mutate(
      { id: taskId, patch: { title, description: description || null } },
      { onSuccess: () => toast.success("Task saved") }
    );
  };

  const handleToggleDone = () => {
    patch({ status: isDone ? "todo" : "done" });
  };

  const handleDuplicate = async () => {
    await createTask.mutateAsync({
      title: `${task.title} (copy)`,
      description: task.description,
      status: task.status,
      priority: task.priority,
      project_id: task.project_id,
      due_date: task.due_date,
      estimate: task.estimate,
    });
    toast.success("Task duplicated");
  };

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
        className="absolute top-0 right-0 flex h-full w-[440px] max-w-full flex-col border-l border-default bg-popover shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleDone}
              aria-label={isDone ? "Mark as not done" : "Mark as done"}
              className="rounded p-0.5 text-secondary transition-colors hover:text-foreground"
            >
              {isDone ? (
                <CheckCircle2 className="size-5 text-success" strokeWidth={1.75} />
              ) : (
                <Circle className="size-5" strokeWidth={1.75} />
              )}
            </button>
            <span className="text-xs font-medium tracking-wide text-secondary uppercase">
              <CheckSquare className="inline size-3.5 mr-1" strokeWidth={1.75} />
              Task
            </span>
            {isOverdue && (
              <Badge variant="destructive" className="gap-1 text-[10px] px-1.5 py-0">
                <AlertCircle className="size-2.5" strokeWidth={1.75} />
                Overdue
              </Badge>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close task details"
            className="rounded-md p-1 text-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div className="space-y-1.5">
            <Label htmlFor="task-panel-title">Title</Label>
            <Input
              id="task-panel-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={cn(isDone && "line-through text-faint")}
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
              <Label htmlFor="task-panel-due">
                Due date
                {isOverdue && (
                  <span className="ml-1 text-[10px] font-medium text-danger">overdue</span>
                )}
              </Label>
              <Input
                id="task-panel-due"
                type="date"
                value={task.due_date ?? ""}
                onChange={(e) => patch({ due_date: e.target.value || null })}
                className={cn(isOverdue && "border-danger/50 text-danger")}
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
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="Add context, links, or notes…"
            />
          </div>

          {/* Subtasks */}
          <div className="space-y-2">
            <Label className="inline-flex items-center gap-1.5">
              <ListChecks className="size-4" strokeWidth={1.75} />
              Subtasks
              {task.subtasks?.length > 0 && (
                <span className="text-xs text-faint">
                  ({task.subtasks.filter((s) => s.done).length}/{task.subtasks.length})
                </span>
              )}
            </Label>
            {(task.subtasks ?? []).map((sub) => (
              <div key={sub.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const updated = task.subtasks.map((s) =>
                      s.id === sub.id ? { ...s, done: !s.done } : s
                    );
                    patch({ subtasks: updated });
                  }}
                  className="shrink-0 text-secondary hover:text-foreground"
                >
                  {sub.done ? (
                    <CheckCircle2 className="size-4 text-success" strokeWidth={1.75} />
                  ) : (
                    <Circle className="size-4" strokeWidth={1.75} />
                  )}
                </button>
                <span className={cn("flex-1 text-sm", sub.done && "line-through text-faint")}>
                  {sub.title}
                </span>
                <button
                  type="button"
                  onClick={() => patch({ subtasks: task.subtasks.filter((s) => s.id !== sub.id) })}
                  className="shrink-0 rounded p-0.5 text-faint hover:text-danger"
                >
                  <X className="size-3" strokeWidth={1.75} />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Input
                placeholder="Add subtask…"
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newSubtask.trim()) {
                    patch({
                      subtasks: [
                        ...(task.subtasks ?? []),
                        { id: crypto.randomUUID(), title: newSubtask.trim(), done: false },
                      ],
                    });
                    setNewSubtask("");
                  }
                }}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                disabled={!newSubtask.trim()}
                onClick={() => {
                  patch({
                    subtasks: [
                      ...(task.subtasks ?? []),
                      { id: crypto.randomUUID(), title: newSubtask.trim(), done: false },
                    ],
                  });
                  setNewSubtask("");
                }}
              >
                <Plus className="size-4" strokeWidth={1.75} />
              </Button>
            </div>
          </div>

          {/* Time tracking */}
          <div className="space-y-2">
            <Label className="inline-flex items-center gap-1.5">
              <Clock className="size-4" strokeWidth={1.75} />
              Time logged
              {task.time_spent ? (
                <span className="text-xs text-faint">{task.time_spent} hrs total</span>
              ) : null}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                step={0.25}
                placeholder="Add hours…"
                value={logHours}
                onChange={(e) => setLogHours(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                disabled={!logHours || Number(logHours) <= 0}
                onClick={() => {
                  const delta = Number(logHours);
                  if (!delta) return;
                  patch({ time_spent: (task.time_spent ?? 0) + delta });
                  setLogHours("");
                }}
              >
                Log
              </Button>
            </div>
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

          {/* Comments */}
          <div className="space-y-2">
            <Label className="inline-flex items-center gap-1.5">
              <MessageCircle className="size-4" strokeWidth={1.75} />
              Comments
              {comments && comments.length > 0 && (
                <span className="text-xs text-faint">({comments.length})</span>
              )}
            </Label>
            {(comments ?? []).length === 0 ? (
              <p className="text-sm text-faint">No comments yet.</p>
            ) : (
              <div className="space-y-2">
                {(comments ?? []).map((c) => (
                  <div
                    key={c.id}
                    className="group flex gap-2 rounded-md border border-border-subtle bg-surface px-3 py-2"
                  >
                    <p className="flex-1 text-sm leading-relaxed whitespace-pre-wrap break-words">{c.body}</p>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-[10px] text-faint">
                        {new Date(c.created_at).toLocaleDateString()}
                      </span>
                      <button
                        type="button"
                        onClick={() => void deleteComment.mutateAsync(c.id)}
                        className="rounded p-0.5 text-faint opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                        aria-label="Delete comment"
                      >
                        <X className="size-3" strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-1.5">
              <Textarea
                placeholder="Add a comment…"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={2}
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={!newComment.trim() || createComment.isPending}
                onClick={async () => {
                  if (!newComment.trim()) return;
                  await createComment.mutateAsync(newComment.trim());
                  setNewComment("");
                  toast.success("Comment added");
                }}
              >
                <Plus className="size-3.5" strokeWidth={1.75} />
                Post comment
              </Button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="space-y-2 border-t border-border-subtle px-5 py-4">
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={handleSave}
              disabled={updateTask.isPending}
            >
              <Save className="size-4" strokeWidth={1.75} />
              {updateTask.isPending ? "Saving…" : "Save"}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => void handleDuplicate()}
              disabled={createTask.isPending}
              aria-label="Duplicate task"
              title="Duplicate"
            >
              <Copy className="size-4" strokeWidth={1.75} />
            </Button>
          </div>
          <Button
            variant="ghost"
            className="w-full text-danger hover:bg-danger/10 hover:text-danger"
            onClick={() => void handleDelete()}
          >
            <Trash2 className="size-4" strokeWidth={1.75} />
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
