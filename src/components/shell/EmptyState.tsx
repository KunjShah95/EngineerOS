import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
}

export function EmptyState({ icon: Icon, title, description, actionLabel }: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="rounded-md bg-accent-muted p-3">
        <Icon className="size-6 text-accent" strokeWidth={1.75} />
      </div>
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {description ? <p className="max-w-sm text-sm text-faint">{description}</p> : null}
      {actionLabel ? <Button className="mt-2">{actionLabel}</Button> : null}
    </div>
  );
}
