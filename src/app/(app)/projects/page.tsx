import { FolderKanban } from "lucide-react";
import { EmptyState } from "@/components/shell/EmptyState";

export default function ProjectsPage() {
  return (
    <EmptyState
      icon={FolderKanban}
      title="Projects"
      description="Project cards with name, status, and color will live here. Create your first project to get started."
      actionLabel="New Project"
    />
  );
}
