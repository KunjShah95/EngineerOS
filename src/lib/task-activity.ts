import { CheckSquare, Link2, MessageCircle, Pencil, Unlink } from "lucide-react";

import type { Project, TaskActivityRow } from "@/types/database";

export const ACTIVITY_ICONS: Record<string, typeof Pencil> = {
  created: CheckSquare,
  updated: Pencil,
  comment_added: MessageCircle,
  dependency_added: Link2,
  dependency_removed: Unlink,
};

/** Human-readable summary of one task_activity row. */
export function activityText(row: TaskActivityRow, projects: Project[] = []): string {
  const m = row.metadata;
  switch (row.action) {
    case "created":
      return "Task created";
    case "comment_added":
      return "Added a comment";
    case "dependency_added":
      return "Added a dependency";
    case "dependency_removed":
      return "Removed a dependency";
    case "updated": {
      const parts: string[] = [];
      if (m.status) {
        const s = m.status as { to?: string };
        parts.push(`Status → ${(s.to ?? "").replace("_", " ")}`);
      }
      if (m.priority) {
        const p = m.priority as { to?: string };
        parts.push(`Priority → ${p.to ?? ""}`);
      }
      if (m.due_date) {
        const d = m.due_date as { to?: string | null };
        parts.push(d.to ? `Due ${d.to}` : "Due date removed");
      }
      if (m.project) {
        const p = m.project as { to?: string | null };
        const name = projects.find((pr) => pr.id === p.to)?.name;
        parts.push(name ? `Project → ${name}` : "Project changed");
      }
      if (m.estimate) {
        const e = m.estimate as { to?: number | null };
        parts.push(e.to != null ? `Estimate → ${e.to}h` : "Estimate removed");
      }
      if (m.title) {
        const t = m.title as { to?: string };
        if (t.to) parts.push(`Renamed to “${t.to}”`);
      }
      return parts.length > 0 ? parts.join(" · ") : "Task updated";
    }
    default:
      return "Task updated";
  }
}
