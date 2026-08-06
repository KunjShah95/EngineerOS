"use client";

import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  type DragOverEvent,
  type DragStartEvent,
  type DragEndEvent,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";

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
    activeStatusRef.current = findColumnOf(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const sourceStatus = activeStatusRef.current;
    if (!sourceStatus) return;

    const targetStatus = resolveTarget(overId);
    if (!targetStatus) return;

    if (sourceStatus !== targetStatus) {
      // Cross-column: move the card into the hovered column.
      setColumns((prev) => {
        const item = prev[sourceStatus].find((t) => t.id === activeId);
        if (!item) return prev;

        const source = prev[sourceStatus].filter((t) => t.id !== activeId);
        const target = [...prev[targetStatus]];
        const overIndex = overId.startsWith("column:")
          ? target.length
          : target.findIndex((t) => t.id === overId);
        const insertAt = overIndex === -1 ? target.length : overIndex;
        target.splice(insertAt, 0, item);

        return { ...prev, [sourceStatus]: source, [targetStatus]: target };
      });
      activeStatusRef.current = targetStatus;
    } else if (overId !== activeId && !overId.startsWith("column:")) {
      // Same-column reorder.
      setColumns((prev) => {
        const items = prev[sourceStatus];
        const from = items.findIndex((t) => t.id === activeId);
        const to = items.findIndex((t) => t.id === overId);
        if (from === -1 || to === -1 || from === to) return prev;
        return { ...prev, [sourceStatus]: arrayMove(items, from, to) };
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const sourceStatus = activeStatusRef.current;
    const { active, over } = event;
    draggingRef.current = false;
    activeStatusRef.current = null;

    if (!over || !sourceStatus) {
      setColumns(tasks ? groupByStatus(tasks) : EMPTY_COLUMNS);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;
    const targetStatus = resolveTarget(overId) ?? sourceStatus;

    const destIds = columnsRef.current[targetStatus].map((t) => t.id);
    const prevIds =
      sourceStatus === targetStatus
        ? null
        : columnsRef.current[sourceStatus].map((t) => t.id);

    reorder.mutate({
      taskId: activeId,
      newStatus: targetStatus,
      orderedIds: destIds,
      previousOrderedIds: prevIds,
    });
  };

  const handleDragCancel = () => {
    draggingRef.current = false;
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
      collisionDetection={closestCorners}
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
