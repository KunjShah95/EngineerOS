"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ExternalLink, FileText, Scale, Search, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/shell/EmptyState";
import { CaptureChatDialog } from "@/components/decisions/CaptureChatDialog";
import { useDecisions, useDeleteDecision } from "@/hooks/useDecisions";
import { useWorkspace } from "@/hooks/useWorkspace";
import type { DecisionRecord } from "@/types/database";

/**
 * Decision log: every "why" EngineerOS has pulled out of merged PRs and notes,
 * newest first. Records are derived from their note — open the note for the
 * full evidence, re-extract there after editing it.
 */
export function DecisionsPage() {
  const { data: workspace } = useWorkspace();
  const workspaceId = workspace?.id ?? null;
  const { data: decisions, isLoading } = useDecisions(workspaceId);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return decisions ?? [];
    return (decisions ?? []).filter((d) =>
      [d.title, d.decision, d.context, d.consequences, ...d.alternatives.map((a) => a.option)]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [decisions, query]);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-6">
      <PageHeader
        icon={Scale}
        title="Decisions"
        description="The why behind your code — extracted automatically from merged PRs, notes and pasted chats."
        className="mb-6"
        actions={<CaptureChatDialog workspaceId={workspaceId} />}
      />

      {(decisions?.length ?? 0) > 0 && (
        <div className="relative mb-5">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" strokeWidth={1.75} />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter decisions…"
            className="pl-9"
            aria-label="Filter decisions"
          />
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (decisions ?? []).length === 0 ? (
        <EmptyState
          icon={Scale}
          title="No decisions yet"
          description="Paste a chat above, link a repo under Settings → GitHub to capture merged PRs automatically, or open any note and choose “Extract decision”."
        />
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-faint">No decisions match “{query}”.</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((d) => (
            <li key={d.id}>
              <DecisionCard decision={d} workspaceId={workspaceId} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DecisionCard({ decision: d, workspaceId }: { decision: DecisionRecord; workspaceId: string | null }) {
  const remove = useDeleteDecision(workspaceId);

  return (
    <article className="rounded-xl border border-default bg-surface p-4">
      <header className="mb-2 flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">{d.title}</h2>
        <time className="shrink-0 text-xs text-faint" dateTime={d.created_at}>
          {new Date(d.created_at).toLocaleDateString()}
        </time>
      </header>

      <p className="text-sm leading-relaxed text-foreground">{d.decision}</p>

      <dl className="mt-3 space-y-2 text-sm">
        {d.context && <Field label="Context">{d.context}</Field>}
        {d.alternatives.length > 0 && (
          <Field label="Rejected">
            <ul className="space-y-1">
              {d.alternatives.map((a, i) => (
                <li key={i}>
                  <span className="text-foreground">{a.option}</span>
                  {a.rejected_because && <span className="text-secondary"> — {a.rejected_because}</span>}
                </li>
              ))}
            </ul>
          </Field>
        )}
        {d.consequences && <Field label="Trade-offs">{d.consequences}</Field>}
        {d.revisit_when && <Field label="Revisit when">{d.revisit_when}</Field>}
      </dl>

      <footer className="mt-4 flex items-center gap-4 text-xs">
        <Link href={`/notes/${d.note_id}`} className="inline-flex items-center gap-1 text-accent hover:text-accent-hover">
          <FileText className="size-3.5" strokeWidth={1.75} />
          Source note
        </Link>
        {d.source_url && (
          <a
            href={d.source_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-secondary hover:text-foreground"
          >
            <ExternalLink className="size-3.5" strokeWidth={1.75} />
            Pull request
          </a>
        )}
        <button
          type="button"
          onClick={() =>
            remove.mutate(d.id, {
              onSuccess: () => toast.success("Decision removed"),
              onError: () => toast.error("Couldn't remove decision"),
            })
          }
          disabled={remove.isPending}
          className="ml-auto inline-flex items-center gap-1 text-faint transition-colors hover:text-foreground"
          aria-label={`Remove decision: ${d.title}`}
        >
          <Trash2 className="size-3.5" strokeWidth={1.75} />
          Not a decision
        </button>
      </footer>
    </article>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[7rem_1fr] sm:gap-3">
      <dt className="text-xs font-medium tracking-wide text-faint uppercase sm:pt-0.5">{label}</dt>
      <dd className="text-secondary">{children}</dd>
    </div>
  );
}
