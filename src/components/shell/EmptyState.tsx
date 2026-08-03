"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <motion.div
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="rounded-md bg-accent-muted p-3"
      >
        <Icon className="size-6 text-accent" strokeWidth={1.75} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="flex flex-col items-center gap-1"
      >
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {description ? (
          <p className="max-w-sm text-sm text-faint">{description}</p>
        ) : null}
        {actionLabel ? (
          <Button className="mt-2" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </motion.div>
    </div>
  );
}
