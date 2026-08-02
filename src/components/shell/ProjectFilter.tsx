"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Project } from "@/types/database";
import { cn } from "@/lib/utils";

/** "all" | "unfiled" | <project id> — the sentinel values must never collide with a uuid. */
export type ProjectFilterValue = string;

export const PROJECT_FILTER_ALL = "all";
export const PROJECT_FILTER_UNFILED = "unfiled";

export function ProjectFilter({
  value,
  onChange,
  projects,
  className,
}: {
  value: ProjectFilterValue;
  onChange: (value: ProjectFilterValue) => void;
  projects: Project[];
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn("w-[180px]", className)}>
        <SelectValue placeholder="All projects" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={PROJECT_FILTER_ALL}>All projects</SelectItem>
        <SelectItem value={PROJECT_FILTER_UNFILED}>Unfiled</SelectItem>
        {projects.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
