import { FolderKanban } from "lucide-react";
import { EmptyState } from "@/components/shell/EmptyState";

export default async function SingleProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <EmptyState
      icon={FolderKanban}
      title="Project"
      description={`Overview, notes, tasks, and resources for project ${id} will render here.`}
    />
  );
}
