"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      {/* Blueprint paper, faintest possible — empty space reads as drafting
          surface rather than a void with an icon floating in it. */}
      <div
        aria-hidden
        className="bg-blueprint pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_70%_70%_at_50%_50%,black,transparent)]"
      />
      <motion.div
        animate={reducedMotion ? undefined : { y: [0, -5, 0] }}
        transition={
          reducedMotion
            ? undefined
            : { duration: 2, repeat: Infinity, ease: "easeInOut" }
        }
        className="flex size-11 items-center justify-center rounded-md border border-border-subtle bg-surface"
      >
        <Icon className="size-5 text-accent" strokeWidth={1.75} />
      </motion.div>

      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reducedMotion ? { duration: 0 } : { delay: 0.1, duration: 0.3 }}
        className="flex flex-col items-center gap-2"
      >
        {/* Every empty state says what it is *for* before what to do — the
            label is the state, the description is the reason it matters. */}
        <p className="label-mono">empty</p>
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {description ? (
          <p className="max-w-sm text-sm leading-relaxed text-faint">{description}</p>
        ) : null}
        {actionLabel ? (
          <Button className="mt-1" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </motion.div>
    </div>
  );
}
