"use client";

import { useMemo, useState } from "react";
import { Hash, X } from "lucide-react";

import { getOrCreateTagIds } from "@/hooks/useTags";
import { cn } from "@/lib/utils";
import type { Tag } from "@/types/database";

interface TagInputProps {
  workspaceId: string;
  /** Currently selected tag ids. */
  tagIds: string[];
  /** All workspace tags, used for name/color lookup. */
  allTags: Tag[];
  onChange: (tagIds: string[]) => void;
  disabled?: boolean;
}

export function TagInput({ workspaceId, tagIds, allTags, onChange, disabled }: TagInputProps) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const nameById = useMemo(() => new Map(allTags.map((t) => [t.id, t])), [allTags]);
  const selected = tagIds
    .map((id) => nameById.get(id))
    .filter((t): t is Tag => Boolean(t));

  const addTag = async (raw: string) => {
    const name = raw.trim().replace(/^#/, "");
    if (!name) return;
    setBusy(true);
    try {
      const ids = await getOrCreateTagIds(workspaceId, [name]);
      const next = ids[0] && !tagIds.includes(ids[0]) ? [...tagIds, ids[0]] : tagIds;
      onChange(next);
    } finally {
      setBusy(false);
    }
  };

  const removeTag = (id: string) => onChange(tagIds.filter((t) => t !== id));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {selected.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium text-accent"
          style={
            tag.color
              ? { backgroundColor: tag.color, color: "#fff" }
              : undefined
          }
        >
          <Hash className="size-3" strokeWidth={1.75} />
          {tag.name}
          <button
            type="button"
            aria-label={`Remove tag ${tag.name}`}
            onClick={() => removeTag(tag.id)}
            className="rounded-sm opacity-60 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40"
            disabled={disabled}
          >
            <X className="size-3" strokeWidth={1.75} />
          </button>
        </span>
      ))}

      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            void addTag(input).then(() => setInput(""));
          } else if (e.key === "Backspace" && input === "" && selected.length > 0) {
            removeTag(selected[selected.length - 1].id);
          }
        }}
        onBlur={() => {
          if (input.trim()) {
            void addTag(input).then(() => setInput(""));
          }
        }}
        placeholder={selected.length === 0 ? "Add tags…" : ""}
        disabled={disabled || busy}
        className={cn(
          "h-6 min-w-24 flex-1 rounded border border-dashed border-transparent bg-transparent px-1 text-sm text-foreground placeholder:text-faint",
          "focus:border-default focus:outline-none focus:ring-2 focus:ring-ring/30"
        )}
      />
    </div>
  );
}
