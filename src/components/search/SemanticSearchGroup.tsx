"use client";

import type { ReactNode } from "react";
import { BookOpen, CalendarDays, CheckSquare, FileText, Search, Sparkles } from "lucide-react";

import { CommandGroup, CommandItem } from "@/components/ui/command";
import type { SemanticMatch } from "@/types/database";

const ICONS: Record<SemanticMatch["entity_type"], ReactNode> = {
  note: <FileText className="size-4 text-secondary" strokeWidth={1.75} />,
  task: <CheckSquare className="size-4 text-secondary" strokeWidth={1.75} />,
  resource: <BookOpen className="size-4 text-secondary" strokeWidth={1.75} />,
  daily_note: <CalendarDays className="size-4 text-secondary" strokeWidth={1.75} />,
  pdf: <Search className="size-4 text-secondary" strokeWidth={1.75} />,
};

function hrefFor(match: SemanticMatch): string {
  switch (match.entity_type) {
    case "note":
      return `/notes/${match.entity_id}`;
    case "task":
      return `/tasks?task=${match.entity_id}`;
    case "resource":
      return match.kind ? `/${match.kind}/${match.entity_id}` : `/notes`;
    case "daily_note":
      return match.date ? `/daily/${match.date}` : `/daily`;
    case "pdf":
      return "/pdf-chat";
  }
}

export function SemanticSearchGroup({
  chunks,
  mode,
  onSelect,
}: {
  chunks: SemanticMatch[];
  mode?: string;
  onSelect: (href: string) => void;
}) {
  if (!chunks || chunks.length === 0) return null;

  return (
    <CommandGroup heading="Semantic">
      <p className="px-2 pt-1 pb-1 text-[10px] font-medium text-faint uppercase">
        {mode === "embeddings" ? "vector search" : "local match"}
      </p>
      {chunks.map((c, i) => (
        <CommandItem
          key={`${c.entity_type}:${c.entity_id}:${c.chunk_index}`}
          value={`sem:${c.entity_type}:${i}`}
          onSelect={() => onSelect(hrefFor(c))}
        >
          {ICONS[c.entity_type] ?? <Sparkles className="size-4 text-secondary" strokeWidth={1.75} />}
          <span className="line-clamp-1">{c.content}</span>
          <span className="ml-auto shrink-0 font-mono text-[10px] text-faint">
            {Math.round(c.score * 100)}%
          </span>
        </CommandItem>
      ))}
    </CommandGroup>
  );
}
