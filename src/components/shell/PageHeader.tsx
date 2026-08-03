"use client";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: LucideIcon;
  iconClassName?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  iconClassName,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "mb-6 flex flex-wrap items-start justify-between gap-4",
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-3.5">
        {Icon ? (
          <span
            className={cn(
              "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-muted ring-1 ring-accent/20",
              iconClassName
            )}
          >
            <Icon className="size-4.5 text-accent" strokeWidth={1.75} />
          </span>
        ) : null}
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {description ? (
            <p className="mt-0.5 text-sm text-secondary">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
