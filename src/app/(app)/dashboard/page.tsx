import { LayoutDashboard } from "lucide-react";
import { EmptyState } from "@/components/shell/EmptyState";

export default function DashboardPage() {
  return (
    <EmptyState
      icon={LayoutDashboard}
      title="Dashboard"
      description="Today's focus, tasks, and recent notes will appear here once you start using EngineerOS."
    />
  );
}
