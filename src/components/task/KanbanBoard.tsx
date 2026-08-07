"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  type CollisionDetection,
  type DragOverEvent,
  type DragStartEvent,
  type DragEndEvent,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/task/KanbanColumn";
import { TASK_STATUS_META } from "@/lib/task-meta";
import {
  useBlockedTaskIds,
  useReorderTasks,
  useTasks,
  type TaskFilters,
} from "@/hooks/useTasks";
import type { TaskStatus, TaskWithProject } from "@/types/database";

type Columns = Record<TaskStatus, TaskWithProject[]>;

const EMPTY_COLUMNS: Columns = { backlog: [], todo: [], in_progress: [], done: [] };

function groupByStatus(tasks: TaskWithProject[]): Columns {
  const grouped: Columns = { backlog: [], todo: [], in_progress: [], done: [] };
  for (const task of tasks) {
    grouped[task.status]?.push(task);
  }
  for (const status of Object.keys(grouped) as TaskStatus[]) {
    grouped[status].sort((a, b) => a.position - b.position);
  }
  return grouped;
}

interface KanbanBoardProps {
  workspaceId: string;
  filters?: TaskFilters | null;
  onOpenTask: (id: string) => void;
  onAddTask: (status: TaskStatus) => void;
}

export function KanbanBoard({ workspaceId, filters, onOpenTask, onAddTask }: KanbanBoardProps) {
  const { data: tasks, isLoading } = useTasks(workspaceId, filters);
  const reorder = useReorderTasks(workspaceId);
  const { data: blockedIds } = useBlockedTaskIds(workspaceId);

  const [columns, setColumns] = useState<Columns>(EMPTY_COLUMNS);
  const draggingRef = useRef(false);
  /** Column the drag started in — never overwritten mid-drag. */
  const originStatusRef = useRef<TaskStatus | null>(null);
  /** Column the dragged card currently sits in (updated on cross-column moves). */
  const activeStatusRef = useRef<TaskStatus | null>(null);
  const columnsRef = useRef(columns);

  useEffect(() => {
    columnsRef.current = columns;
  }, [columns]);

  // Re-sync from server data whenever it changes (and we're not mid-drag).
  useEffect(() => {
    if (!draggingRef.current) {
      setColumns(tasks ? groupByStatus(tasks) : EMPTY_COLUMNS);
    }
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  // Resolve the drop target by where the pointer actually is, not by which
  // droppable has the nearest *corner*. `closestCorners` biases toward tall
  // columns (e.g. a full "Done") over a short empty one (e.g. "In Progress"),
  // so hovering an empty column would drop into its taller neighbour instead —
  // and because our optimistic reorder changes column heights mid-drag, the
  // corner-based target oscillated every frame, spamming setState until React
  // threw "Maximum update depth exceeded". Pointer position is layout-stable,
  // so this both fixes the wrong-column drop and stops the render loop.
  // Fall back to closestCorners only when the pointer is outside every column.
  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const pointerCollisions = pointerWithin(args);
    return pointerCollisions.length > 0 ? pointerCollisions : closestCorners(args);
  }, []);

  const findColumnOf = (id: string): TaskStatus | null => {
    for (const status of TASK_STATUS_META.map((s) => s.value)) {
      if (columnsRef.current[status].some((t) => t.id === id)) return status;
    }
    return null;
  };

  const resolveTarget = (overId: string): TaskStatus | null => {
    if (overId.startsWith("column:")) {
      return overId.replace("column:", "") as TaskStatus;
    }
    return findColumnOf(overId);
  };

  const handleDragStart = (event: DragStartEvent) => {
    draggingRef.current = true;
    const status = findColumnOf(event.active.id as string);
    originStatusRef.current = status;
    activeStatusRef.current = status;
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const sourceStatus = activeStatusRef.current;
    if (!sourceStatus) return;

    const targetStatus = resolveTarget(overId);
    if (!targetStatus) return;

    // Insert before/after the hovered card based on the pointer's vertical
    // position. The index is always computed against the column *without* the
    // dragged card, so consecutive dragOver events settle on one stable layout
    // instead of flipping the card back and forth around the hovered card.
    const isBelowOver = () => {
      const translated = active.rect.current.translated;
      if (!translated) return false;
      return translated.top > over.rect.top + over.rect.height / 2;
    };

    setColumns((prev) => {
      const items = prev[sourceStatus];
      if (!items) return prev;
      const from = items.findIndex((t) => t.id === activeId);
      if (from === -1) return prev;
      const item = items[from];
      const rest = items.filter((t) => t.id !== activeId);

      if (sourceStatus !== targetStatus) {
        // Cross-column: drop into the hovered column at the pointer-relative slot.
        const target = [...prev[targetStatus]];
        const overIndex = target.findIndex((t) => t.id === overId);
        const dest = overId.startsWith("column:")
          ? target.length
          : overIndex === -1
            ? target.length
            : isBelowOver()
              ? overIndex + 1
              : overIndex;
        target.splice(Math.min(dest, target.length), 0, item);
        return { ...prev, [sourceStatus]: rest, [targetStatus]: target };
      }

      // Same-column reorder — only when hovering another card.
      if (overId.startsWith("column:")) return prev;
      const overIndex = rest.findIndex((t) => t.id === overId);
      if (overIndex === -1) return prev;
      const dest = isBelowOver() ? overIndex + 1 : overIndex;
      // No-op when the card is already in its target slot — avoids re-rendering
      // the board on every pointermove during a stable hover.
      if (dest === from) return prev;
      const next = [...rest];
      next.splice(Math.min(dest, next.length), 0, item);
      return { ...prev, [sourceStatus]: next };
    });

    if (sourceStatus !== targetStatus) {
      activeStatusRef.current = targetStatus;
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const originStatus = originStatusRef.current;
    const currentStatus = activeStatusRef.current;
    draggingRef.current = false;
    originStatusRef.current = null;
    activeStatusRef.current = null;

    if (!over || !originStatus) {
      setColumns(tasks ? groupByStatus(tasks) : EMPTY_COLUMNS);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;
    const targetStatus = resolveTarget(overId) ?? currentStatus ?? originStatus;

    const destIds = columnsRef.current[targetStatus]?.map((t) => t.id) ?? [];
    // Only a genuine cross-column move needs the origin column renumbered —
    // the dragged card has already been removed from it during dragOver.
    const prevIds =
      originStatus !== targetStatus
        ? (columnsRef.current[originStatus]?.map((t) => t.id) ?? null)
        : null;

    reorder.mutate({
      taskId: activeId,
      newStatus: targetStatus,
      orderedIds: destIds,
      previousOrderedIds: prevIds,
    });
  };

  const handleDragCancel = () => {
    draggingRef.current = false;
    originStatusRef.current = null;
    activeStatusRef.current = null;
    setColumns(tasks ? groupByStatus(tasks) : EMPTY_COLUMNS);
  };

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {TASK_STATUS_META.map((s) => (
          <div
            key={s.value}
            className="h-40 w-72 shrink-0 animate-pulse rounded-lg border border-border-subtle bg-surface"
          />
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {TASK_STATUS_META.map(({ value, label }) => (
          <KanbanColumn
            key={value}
            status={value}
            label={label}
            tasks={columns[value]}
            onOpenTask={onOpenTask}
            onAddTask={onAddTask}
            blockedIds={blockedIds}
          />
        ))}
      </div>
    </DndContext>
  );
}
