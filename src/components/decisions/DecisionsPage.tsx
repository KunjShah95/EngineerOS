"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, ExternalLink, FileText, Scale, Search, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/shell/EmptyState";
import { CaptureChatDialog } from "@/components/decisions/CaptureChatDialog";
import {
  useDecisionConflicts,
  useDecisions,
  useDeleteDecision,
  useReactivateDecision,
  useResolveConflict,
} from "@/hooks/useDecisions";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";
import type { DecisionConflict, DecisionRecord } from "@/types/database";

type View = "all" | "review" | "superseded";

/**
 * Decision log: every "why" EngineerOS has pulled out of merged PRs, notes
 * and pasted chats, newest first. Records are derived from their note — open
 * the note for the full evidence, re-extract there after editing it.
 *
 * When a newer decision looks like it reverses an older one, the older card
 * carries an alert until someone accepts (older becomes superseded) or
 * dismisses it.
 */
export function DecisionsPage() {
  const { data: workspace } = useWorkspace();
  const workspaceId = workspace?.id ?? null;
  const { data: decisions, isLoading } = useDecisions(workspaceId);
  const { data: conflicts = [] } = useDecisionConflicts(workspaceId);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("all");

  const byId = useMemo(() => new Map((decisions ?? []).map((d) => [d.id, d])), [decisions]);
  const alertsByEarlier = useMemo(() => {
    const map = new Map<string, DecisionConflict[]>();
    for (const c of conflicts) map.set(c.earlier_decision_id, [...(map.get(c.earlier_decision_id) ?? []), c]);
    return map;
  }, [conflicts]);
  const supersededCount = (decisions ?? []).filter((d) => d.status === "superseded").length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (decisions ?? []).filter((d) => {
      if (view === "review" && !alertsByEarlier.has(d.id)) return false;
      if (view === "superseded" ? d.status !== "superseded" : view === "all" && d.status === "superseded") return false;
      if (!q) return true;
      return [d.title, d.decision, d.context, d.consequences, ...d.alternatives.map((a) => a.option)]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [decisions, query, view, alertsByEarlier]);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-6">
      <PageHeader
        icon={Scale}
        title="Decisions"
        description="The why behind your code — extracted automatically from merged PRs, notes and pasted chats."
        className="mb-6"
        actions={<CaptureChatDialog workspaceId={workspaceId} />}
      />

      {alertsByEarlier.size > 0 && view !== "review" && (
        <button
          type="button"
          onClick={() => setView("review")}
          className="mb-5 flex w-full items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-warning/15"
        >
          <AlertTriangle className="size-4 shrink-0 text-warning" strokeWidth={1.75} />
          {alertsByEarlier.size} decision{alertsByEarlier.size > 1 ? "s" : ""} may be out of date — a newer decision
          looks like it reverses {alertsByEarlier.size > 1 ? "them" : "it"}.
          <span className="ml-auto text-xs font-medium text-accent">Review</span>
        </button>
      )}

      {(decisions?.length ?? 0) > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" strokeWidth={1.75} />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter decisions…"
              className="pl-9"
              aria-label="Filter decisions"
            />
          </div>
          <div className="flex gap-1 text-xs" role="tablist" aria-label="Decision view">
            <ViewTab active={view === "all"} onClick={() => setView("all")}>
              Current
            </ViewTab>
            <ViewTab active={view === "review"} onClick={() => setView("review")}>
              Needs review{alertsByEarlier.size > 0 ? ` (${alertsByEarlier.size})` : ""}
            </ViewTab>
            <ViewTab active={view === "superseded"} onClick={() => setView("superseded")}>
              Superseded{supersededCount > 0 ? ` (${supersededCount})` : ""}
            </ViewTab>
          </div>
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
        <p className="py-8 text-center text-sm text-faint">
          {query ? `No decisions match “${query}”.` : view === "review" ? "Nothing to review." : "Nothing here yet."}
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((d) => (
            <li key={d.id}>
              <DecisionCard
                decision={d}
                workspaceId={workspaceId}
                alerts={alertsByEarlier.get(d.id) ?? []}
                lookup={byId}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ViewTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "rounded-md px-2.5 py-1.5 transition-colors",
        active ? "bg-accent-muted text-foreground" : "text-secondary hover:bg-surface-hover hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function DecisionCard({
  decision: d,
  workspaceId,
  alerts,
  lookup,
}: {
  decision: DecisionRecord;
  workspaceId: string | null;
  alerts: DecisionConflict[];
  lookup: Map<string, DecisionRecord>;
}) {
  const remove = useDeleteDecision(workspaceId);
  const reactivate = useReactivateDecision(workspaceId);
  const supersededBy = d.superseded_by ? lookup.get(d.superseded_by) : undefined;

  return (
    <article
      className={cn(
        "rounded-xl border bg-surface p-4",
        alerts.length > 0 ? "border-warning/50" : "border-default",
        d.status === "superseded" && "opacity-70",
      )}
    >
      <header className="mb-2 flex items-start justify-between gap-3">
        <h2 className={cn("text-sm font-semibold text-foreground", d.status === "superseded" && "line-through")}>
          {d.title}
        </h2>
        <time className="shrink-0 text-xs text-faint" dateTime={d.created_at}>
          {new Date(d.created_at).toLocaleDateString()}
        </time>
      </header>

      {d.status === "superseded" && (
        <p className="mb-2 flex flex-wrap items-center gap-x-2 text-xs text-secondary">
          Superseded{supersededBy ? " by " : ""}
          {supersededBy && (
            <Link href={`/notes/${supersededBy.note_id}`} className="font-medium text-accent hover:text-accent-hover">
              {supersededBy.title}
            </Link>
          )}
          <button
            type="button"
            onClick={() =>
              reactivate.mutate(d.id, {
                onSuccess: () => toast.success("Marked as current again"),
                onError: () => toast.error("Couldn't update decision"),
              })
            }
            disabled={reactivate.isPending}
            className="text-faint underline-offset-2 hover:text-foreground hover:underline"
          >
            Still valid
          </button>
        </p>
      )}

      {alerts.map((alert) => (
        <ConflictAlert key={alert.id} alert={alert} newer={lookup.get(alert.decision_id)} workspaceId={workspaceId} />
      ))}

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

function ConflictAlert({
  alert,
  newer,
  workspaceId,
}: {
  alert: DecisionConflict;
  newer: DecisionRecord | undefined;
  workspaceId: string | null;
}) {
  const resolve = useResolveConflict(workspaceId);
  const act = (accept: boolean) =>
    resolve.mutate(
      { conflict: alert, accept },
      {
        onSuccess: () => toast.success(accept ? "Marked as superseded" : "Alert dismissed"),
        onError: () => toast.error("Couldn't update the alert"),
      },
    );

  return (
    <div className="mb-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs" role="alert">
      <p className="mb-1 flex items-center gap-1.5 font-semibold text-foreground">
        <AlertTriangle className="size-3.5 text-warning" strokeWidth={1.75} />
        {alert.relation === "supersedes" ? "May be reversed by" : "May conflict with"}{" "}
        {newer ? (
          <Link href={`/notes/${newer.note_id}`} className="text-accent hover:text-accent-hover">
            {newer.title}
          </Link>
        ) : (
          "a newer decision"
        )}
      </p>
      {alert.reason && <p className="mb-2 text-secondary">{alert.reason}</p>}
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => act(true)} disabled={resolve.isPending}>
          Mark superseded
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => act(false)} disabled={resolve.isPending}>
          Still holds — dismiss
        </Button>
      </div>
    </div>
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
