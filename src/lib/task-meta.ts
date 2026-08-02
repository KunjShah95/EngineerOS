import type { TaskPriority, TaskStatus } from "@/types/database";

export const TASK_STATUS_META: { value: TaskStatus; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "Todo" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
];

export const PRIORITY_META: { value: TaskPriority; label: string; color: string }[] = [
  { value: "urgent", label: "Urgent", color: "var(--priority-urgent)" },
  { value: "high", label: "High", color: "var(--priority-high)" },
  { value: "medium", label: "Medium", color: "var(--priority-medium)" },
  { value: "low", label: "Low", color: "var(--priority-low)" },
  { value: "none", label: "None", color: "var(--priority-none)" },
];

export function priorityColor(priority: TaskPriority): string {
  return PRIORITY_META.find((p) => p.value === priority)?.color ?? "var(--priority-none)";
}
