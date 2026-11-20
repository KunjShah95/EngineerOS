"use client";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  /** Small mono label above the title, e.g. the section name. */
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: LucideIcon;
  iconClassName?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  eyebrow,
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
        "mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-border-subtle pb-5",
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          /* Not a filled rounded chip — that's the default-dashboard tell. A
             hairline square with the icon inside reads as a tool marking a
             panel, and it doesn't add a second color field to every page. */
          <span
            className={cn(
              "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface",
              iconClassName
            )}
          >
            <Icon className="size-4 text-accent" strokeWidth={1.75} />
          </span>
        ) : null}
        <div className="min-w-0">
          {eyebrow ? <p className="label-mono mb-1">{eyebrow}</p> : null}
          <h1 className="font-serif-display text-[1.65rem] leading-tight font-normal tracking-[-0.015em] text-foreground">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 text-sm text-secondary">{description}</p>
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
