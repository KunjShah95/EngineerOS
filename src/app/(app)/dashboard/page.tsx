import { LayoutDashboard } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="rounded-md bg-accent-muted p-3">
        <LayoutDashboard className="size-6 text-accent" strokeWidth={1.75} />
      </div>
      <h3 className="text-sm font-medium text-foreground">Dashboard</h3>
      <p className="max-w-sm text-sm text-faint">
        Today&apos;s focus, tasks, and recent notes will appear here once you start using EngineerOS.
      </p>
    </div>
  );
}
