"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, Hash, Pin, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shell/EmptyState";
import { useCreateNote, useNotes } from "@/hooks/useNotes";
import { useProjects } from "@/hooks/useProjects";
import { useWorkspace } from "@/hooks/useWorkspace";
import { projectColorStyle } from "@/lib/project-colors";
import { cn } from "@/lib/utils";
import type { NoteWithRelations } from "@/types/database";

function snippet(body: string): string {
  return body
    .replace(/[#*`>_~\[\]()!-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

export function NotesList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: workspace } = useWorkspace();
  const workspaceId = workspace?.id ?? null;

  const { data: projects } = useProjects(workspaceId);

  const projectFilter = searchParams.get("project") ?? "all";
  const tagFilter = searchParams.get("tag") ?? "all";

  const { data: notes, isLoading } = useNotes(
    workspaceId,
    projectFilter === "all" ? null : { projectId: projectFilter }
  );

  const createNote = useCreateNote(workspaceId);

  const filtered = useMemo(() => {
    if (tagFilter === "all") return notes ?? [];
    return (notes ?? []).filter((n) =>
      n.note_tags.some((nt) => nt.tag.name === tagFilter)
    );
  }, [notes, tagFilter]);

  const setProject = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") params.delete("project");
    else params.set("project", value);
    router.replace(`/notes?${params.toString()}`);
  };

  const clearTag = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("tag");
    router.replace(`/notes?${params.toString()}`);
  };

  const newNote = async () => {
    const note = await createNote.mutateAsync({});
    router.push(`/notes/${note.id}`);
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Notes</h1>
          <p className="text-sm text-secondary">
            {filtered.length} {filtered.length === 1 ? "note" : "notes"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={projectFilter} onValueChange={setProject}>
            <SelectTrigger size="sm" aria-label="Filter by project" className="min-w-36">
              <SelectValue placeholder="All projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {(projects ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button size="sm" onClick={() => void newNote()} disabled={createNote.isPending}>
            <Plus className="size-4" strokeWidth={1.75} />
            New Note
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={tagFilter !== "all" || projectFilter !== "all" ? "No matching notes" : "No notes yet"}
          description={
            tagFilter !== "all" || projectFilter !== "all"
              ? "Try clearing the filters, or write a new note."
              : "Pinned notes surface here, filterable by project and tag. Write your first markdown note to get started."
          }
          actionLabel={tagFilter !== "all" || projectFilter !== "all" ? undefined : "New Note"}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((note) => (
            <NoteRow key={note.id} note={note} />
          ))}
        </div>
      )}

      {tagFilter !== "all" ? (
        <div className="mt-4 flex items-center gap-2 text-sm">
          <Badge variant="outline" className="gap-1 border-transparent bg-accent-muted text-accent">
            <Hash className="size-3" strokeWidth={1.75} />
            {tagFilter}
          </Badge>
          <button
            type="button"
            onClick={clearTag}
            className="text-xs font-medium text-secondary transition-colors hover:text-foreground"
          >
            Clear tag filter
          </button>
        </div>
      ) : null}
    </div>
  );
}

function NoteRow({ note }: { note: NoteWithRelations }) {
  const tagsList = note.note_tags.map((nt) => nt.tag);

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      <Link
        href={`/notes/${note.id}`}
        className={cn(
          "group flex items-start justify-between gap-4 rounded-lg border border-default bg-surface p-4 transition-colors duration-150",
          "hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {note.pinned ? (
              <Pin className="size-3.5 shrink-0 text-accent" strokeWidth={1.75} />
            ) : null}
            <h3 className="truncate text-sm font-medium text-foreground">{note.title}</h3>
          </div>

          {snippet(note.body_markdown) ? (
            <p className="mt-1 line-clamp-2 text-sm text-secondary">{snippet(note.body_markdown)}</p>
          ) : (
            <p className="mt-1 text-sm text-faint">No content yet.</p>
          )}

          {(note.project || tagsList.length > 0) && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {note.project ? (
                <span className="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px] font-medium text-secondary">
                  <span
                    className="size-2 rounded-full"
                    style={projectColorStyle(note.project.color)}
                    aria-hidden
                  />
                  {note.project.name}
                </span>
              ) : null}
              {tagsList.map((tag) => (
                <span
                  key={tag.id}
                  className="rounded px-1.5 py-0.5 text-[11px] font-medium text-accent"
                  style={tag.color ? { backgroundColor: tag.color, color: "#fff" } : undefined}
                >
                  #{tag.name}
                </span>
              ))}
            </div>
          )}
        </div>

        <span className="shrink-0 text-xs text-faint">
          {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })}
        </span>
      </Link>
    </motion.div>
  );
}
