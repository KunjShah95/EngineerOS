import Link from "next/link";
import { motion } from "framer-motion";
import { CheckSquare, FileText, MoreHorizontal } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { projectColorStyle } from "@/lib/project-colors";
import { cn } from "@/lib/utils";
import type { ProjectStatus, ProjectWithCounts } from "@/types/database";

const statusStyles: Record<ProjectStatus, string> = {
  active: "bg-success/10 text-success",
  paused: "bg-warning/10 text-warning",
  archived: "bg-muted text-secondary",
};

export function ProjectCard({ project }: { project: ProjectWithCounts }) {
  const taskCount = project.tasks[0]?.count ?? 0;
  const noteCount = project.notes[0]?.count ?? 0;

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      <Link
        href={`/projects/${project.id}`}
        className={cn(
          "group flex h-full flex-col gap-3 rounded-lg border border-default bg-surface p-4 transition-colors duration-150",
          "hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="mt-0.5 size-2.5 shrink-0 rounded-full"
              style={projectColorStyle(project.color)}
              aria-hidden
            />
            <h3 className="truncate text-sm font-medium text-foreground group-hover:text-foreground">
              {project.name}
            </h3>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="outline" className={cn("border-transparent", statusStyles[project.status])}>
              {project.status}
            </Badge>
            <MoreHorizontal className="size-4 text-faint opacity-0 transition-opacity duration-150 group-hover:opacity-100" strokeWidth={1.75} />
          </div>
        </div>

        {project.description ? (
          <p className="line-clamp-2 text-sm text-secondary">{project.description}</p>
        ) : null}

        <div className="mt-auto flex items-center gap-4 text-xs text-faint">
          <span className="inline-flex items-center gap-1">
            <CheckSquare className="size-3.5" strokeWidth={1.75} />
            {taskCount} {taskCount === 1 ? "task" : "tasks"}
          </span>
          <span className="inline-flex items-center gap-1">
            <FileText className="size-3.5" strokeWidth={1.75} />
            {noteCount} {noteCount === 1 ? "note" : "notes"}
          </span>
          <span className="ml-auto">
            {formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
