"use client";

import Link from "next/link";
import { Scale } from "lucide-react";

import { useRelatedDecisions } from "@/hooks/useDecisions";

/**
 * "Ask before you build": past decisions that look related to what's being
 * written. Renders nothing until there's a match, so it never adds noise to
 * an ordinary task.
 */
export function RelatedDecisions({ workspaceId, text }: { workspaceId: string | null; text: string }) {
  const { data: related } = useRelatedDecisions(workspaceId, text);
  if (!related || related.length === 0) return null;

  return (
    <div className="rounded-lg border border-accent/30 bg-accent-muted/40 p-3" role="status">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-accent">
        <Scale className="size-3.5" strokeWidth={1.75} />
        Decided before — check first
      </p>
      <ul className="space-y-1.5">
        {related.map((d) => (
          <li key={d.id} className="text-xs">
            <Link
              href={`/notes/${d.note_id}`}
              target="_blank"
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              {d.title}
            </Link>
            <span className="text-secondary"> — {d.decision}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
