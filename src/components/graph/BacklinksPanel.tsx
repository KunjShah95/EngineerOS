"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GitFork, Link2Off, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  useAddNoteLink,
  useKnowledgeGraph,
  useRemoveNoteLink,
} from "@/hooks/useKnowledgeGraph";
import { useWorkspace } from "@/hooks/useWorkspace";
import type { GraphEdge, GraphNode } from "@/types/database";

const KIND_DOT: Record<GraphNode["kind"], string> = {
  note: "#818cf8",
  task: "#60a5fa",
  resource: "#94a3f8",
};

const EDGE_TAG: Record<GraphEdge["kind"], string> = {
  task_note: "task",
  note_link: "link",
  wikilink: "wiki",
};

interface Entry {
  node: GraphNode;
  edge: GraphEdge;
}

export function BacklinksPanel({ noteId }: { noteId: string }) {
  const { data: workspace } = useWorkspace();
  const workspaceId = workspace?.id ?? null;
  const { data: graph } = useKnowledgeGraph(workspaceId);
  const addLink = useAddNoteLink(workspaceId);
  const removeLink = useRemoveNoteLink(workspaceId);

  const [query, setQuery] = useState("");

  // Incoming = edges pointing at this note; outgoing = edges leaving it.
  const { incoming, outgoing } = useMemo(() => {
    const inc: Entry[] = [];
    const out: Entry[] = [];
    for (const e of graph?.edges ?? []) {
      if (e.target === noteId) {
        const node = graph?.nodes.find((n) => n.id === e.source);
        if (node) inc.push({ node, edge: e });
      } else if (e.source === noteId) {
        const node = graph?.nodes.find((n) => n.id === e.target);
        if (node) out.push({ node, edge: e });
      }
    }
    return { incoming: inc, outgoing: out };
  }, [graph, noteId]);

  // Candidate notes to link this note TO (excludes self and already-linked).
  const candidates = useMemo(() => {
    const linked = new Set(outgoing.map((o) => o.node.id));
    const q = query.trim().toLowerCase();
    return (graph?.nodes ?? [])
      .filter((n) => n.kind === "note" && n.id !== noteId && !linked.has(n.id))
      .filter((n) => (q ? n.label.toLowerCase().includes(q) : true))
      .slice(0, 8);
  }, [graph, noteId, outgoing, query]);

  const linkNote = async (linkedNoteId: string) => {
    try {
      await addLink.mutateAsync({ noteId, linkedNoteId });
      setQuery("");
      toast.success("Linked note");
    } catch {
      toast.error("Could not link note");
    }
  };

  const unlink = async (linkedNoteId: string) => {
    try {
      await removeLink.mutateAsync({ noteId, linkedNoteId });
    } catch {
      toast.error("Could not unlink note");
    }
  };

  const Row = ({ entry, direction }: { entry: Entry; direction: "in" | "out" }) => (
    <div className="group flex items-center gap-2">
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: KIND_DOT[entry.node.kind] }}
      />
      <Link
        href={entry.node.href}
        className="min-w-0 flex-1 truncate text-sm text-secondary transition-colors hover:text-foreground"
      >
        {entry.node.label}
      </Link>
      <span className="shrink-0 rounded-full border border-border-subtle px-1.5 py-px text-[9px] text-faint">
        {EDGE_TAG[entry.edge.kind]}
      </span>
      {direction === "out" && entry.edge.kind === "note_link" && (
        <button
          type="button"
          aria-label="Remove link"
          onClick={() => void unlink(entry.node.id)}
          className="hidden shrink-0 rounded p-1 text-faint transition-colors hover:bg-surface-hover hover:text-danger group-hover:block"
        >
          <Link2Off className="size-3" strokeWidth={1.75} />
        </button>
      )}
    </div>
  );

  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-faint uppercase">
          <GitFork className="size-3.5" strokeWidth={1.75} />
          Backlinks · {incoming.length + outgoing.length}
        </p>
      </div>

      {/* Add a link to another note (curated note_link) */}
      <div className="mb-3 flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Link to a note…"
          className="min-w-0 flex-1 rounded-md border border-border-default bg-base px-2.5 py-1.5 text-sm text-foreground outline-none transition-colors placeholder:text-faint focus:border-accent/60 focus:ring-2 focus:ring-ring/30"
        />
      </div>
      {query.trim() && (
        <div className="mb-3 space-y-0.5 rounded-md border border-border-subtle bg-base p-1.5">
          {candidates.length === 0 && (
            <p className="px-2 py-1 text-xs text-faint">No matching notes</p>
          )}
          {candidates.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => void linkNote(n.id)}
              className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm text-secondary transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              <Plus className="size-3 shrink-0 text-faint" strokeWidth={1.75} />
              <span className="min-w-0 flex-1 truncate">{n.label}</span>
            </button>
          ))}
        </div>
      )}

      {incoming.length > 0 && (
        <div className="mb-2">
          <p className="mb-1 text-[10px] font-semibold text-faint uppercase">Linked from</p>
          <div className="space-y-1">
            {incoming.slice(0, 12).map((entry, i) => (
              <Row key={`in-${entry.node.id}-${i}`} entry={entry} direction="in" />
            ))}
          </div>
        </div>
      )}

      {outgoing.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-semibold text-faint uppercase">Links to</p>
          <div className="space-y-1">
            {outgoing.slice(0, 12).map((entry, i) => (
              <Row key={`out-${entry.node.id}-${i}`} entry={entry} direction="out" />
            ))}
          </div>
        </div>
      )}

      {incoming.length === 0 && outgoing.length === 0 && (
        <p className="text-xs text-faint">
          No connections yet. Type [[Note Title]] in any note, or use the box above.
        </p>
      )}
    </div>
  );
}
