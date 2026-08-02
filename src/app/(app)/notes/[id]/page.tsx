import { FileText } from "lucide-react";
import { EmptyState } from "@/components/shell/EmptyState";

export default async function SingleNotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <EmptyState
      icon={FileText}
      title="Note"
      description={`Markdown editor and preview for note ${id} will render here.`}
    />
  );
}
