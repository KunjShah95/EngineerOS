import { FileText } from "lucide-react";
import { EmptyState } from "@/components/shell/EmptyState";

export default function NotesPage() {
  return (
    <EmptyState
      icon={FileText}
      title="Notes"
      description="Pinned notes surface here, filterable by project and tag. Write your first markdown note to get started."
      actionLabel="New Note"
    />
  );
}
