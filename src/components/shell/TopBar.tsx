import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shell/ThemeToggle";

export function TopBar() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-default bg-surface px-4">
      <span className="text-sm font-medium text-secondary">EngineerOS</span>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" disabled aria-label="Quick capture — coming soon">
          <Plus className="size-4" strokeWidth={1.75} />
          Quick Capture
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}
