"use client";

import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useProgress } from "./use-progress";

export function CompleteButton({ id }: { id: string }) {
  const { completed, toggle } = useProgress();
  const done = completed.has(id);
  return (
    <Button
      type="button"
      variant={done ? "secondary" : "default"}
      onClick={() => toggle(id)}
      aria-pressed={done}
    >
      <Check className="size-4" strokeWidth={1.75} />
      {done ? "Completed" : "Mark as done"}
    </Button>
  );
}
