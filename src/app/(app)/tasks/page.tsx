import { CheckSquare } from "lucide-react";
import { EmptyState } from "@/components/shell/EmptyState";

export default function TasksPage() {
  return (
    <EmptyState
      icon={CheckSquare}
      title="Tasks"
      description="The kanban board — Backlog, Todo, In Progress, Done — will render here. Drag your first task across columns to get started."
      actionLabel="New Task"
    />
  );
}
