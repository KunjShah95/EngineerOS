"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, ChevronDown, ChevronRight, History } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ChatSource, RetrievalMode } from "@/types/database";

/**
 * "Why this answer" — the retrieval inspector.
 *
 * Every assistant answer states which excerpts it was built from, but until now
 * it only showed the *titles* of those excerpts as pills. A user who disagrees
 * with the answer has no way to check whether the right passage was retrieved,
 * whether it was found by meaning or by literal keyword overlap, or how confident
 * that match was. This panel surfaces exactly that, per source: the retriever,
 * the score, the chunk that was quoted, and (for time-travel answers) what has
 * changed since the pinned date.
 *
 * Designed as an instrument readout rather than a chip cloud: hairline rules, a
 * mono label per source, and a measured score in tabular figures, so the numbers
 * line up and can be compared at a glance.
 */

const MODE_LABEL: Record<RetrievalMode, string> = {
  semantic: "semantic",
  keyword: "keyword",
  structured: "structured",
  "time-travel": "as of",
};

const MODE_HINT: Record<RetrievalMode, string> = {
  semantic: "Matched by meaning, using embeddings.",
  keyword: "Matched by word overlap — no embedding provider was available.",
  structured: "Answered from structured rows (tasks, projects, daily notes), not document text.",
  "time-travel": "The version of this note as it existed on the pinned date.",
};

function scorePercent(score: number): number {
  // Keyword scores run to ~1.3; semantic cosine scores are 0..1. Normalize both
  // into a bar width that reads as "relative confidence" rather than a unit.
  return Math.max(4, Math.min(100, Math.round((score / 1.3) * 100)));
}

function formatAsOf(asOf: string): string {
  const d = new Date(`${asOf}T00:00:00`);
  if (Number.isNaN(d.getTime())) return asOf;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function SourceRow({ source }: { source: ChatSource }) {
  const mode: RetrievalMode = source.retrieval ?? "keyword";
  const changed = source.changed_since === true;
  const isHistorical = mode === "time-travel";

  return (
    <li
      className={cn(
        "bg-surface px-3 py-2.5",
        // Provenance rows get a rail: mint for a verified historical read,
        // accent for live retrieval. One mark, no extra chrome.
        isHistorical ? "rail-signal" : "rail-accent"
      )}
    >
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <Link
          href={source.href}
          className="min-w-0 truncate text-sm text-foreground underline-offset-2 transition-colors hover:text-accent hover:underline"
        >
          {source.title}
        </Link>
        <span
          className="figure-mono shrink-0 text-[11px] text-faint"
          title={`Relevance ${source.score.toFixed(2)}`}
        >
          {source.score.toFixed(2)}
        </span>
      </div>

      {/* Score as a measured bar, aligned on the same baseline grid as the
          figures above — a bar alone can't be compared, a number alone can't be
          scanned. */}
      <div aria-hidden className="mb-2 h-px w-full bg-border-subtle">
        <div
          className={cn("h-px", isHistorical ? "bg-signal/70" : "bg-accent/70")}
          style={{ width: `${scorePercent(source.score)}%` }}
        />
      </div>

      <div className="mb-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="label-mono">{MODE_LABEL[mode]}</span>
        {typeof source.chunk_index === "number" && mode !== "keyword" && (
          <span className="figure-mono text-[10px] text-faint">
            chunk {source.chunk_index + 1}
          </span>
        )}
        {source.as_of && (
          <span className="figure-mono inline-flex items-center gap-1 text-[10px] text-signal">
            <CalendarClock className="size-3" strokeWidth={1.75} />
            {formatAsOf(source.as_of)}
          </span>
        )}
      </div>

      {source.snippet && (
        <p className="border-l border-border-subtle pl-2.5 text-xs leading-relaxed text-secondary">
          {source.snippet}
        </p>
      )}

      {changed && (
        <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-warning">
          <History className="mt-px size-3 shrink-0" strokeWidth={1.75} />
          <span>
            Edited since{source.as_of ? ` ${formatAsOf(source.as_of)}` : ""}
            {source.diff_summary ? ` — ${source.diff_summary}` : ""}
          </span>
        </p>
      )}
    </li>
  );
}

export function SourcesPanel({
  sources,
  strategy,
  asOf,
  unpinned,
}: {
  sources: ChatSource[];
  strategy?: string | null;
  asOf?: string | null;
  unpinned?: { title: string }[];
}) {
  const [open, setOpen] = useState(false);
  if (sources.length === 0) return null;

  const changedCount = sources.filter((s) => s.changed_since).length;
  const mode = sources[0]?.retrieval;
  const isHistorical = mode === "time-travel";

  return (
    <div className="mr-auto mt-1.5 max-w-[85%] pl-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group inline-flex items-center gap-1.5 text-[11px] text-faint transition-colors hover:text-secondary"
      >
        {open ? (
          <ChevronDown className="size-3" strokeWidth={2} />
        ) : (
          <ChevronRight className="size-3" strokeWidth={2} />
        )}
        {/* Count in figures so it aligns with the scores listed below. */}
        <span className="label-mono group-hover:text-secondary">
          {open ? "hide sources" : `${sources.length} sources`}
        </span>
        {isHistorical && asOf && (
          <span className="figure-mono text-[10px] text-signal">as of {asOf}</span>
        )}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {mode && (
            <p className="text-[11px] leading-relaxed text-faint">
              {MODE_HINT[mode]}
              {strategy && strategy !== "structured" ? " " : ""}
            </p>
          )}
          {/* Hairline-divided rows: structure from rules, not from boxes. */}
          <ul className="divide-y divide-border-subtle border-y border-border-subtle">
            {sources.map((s, i) => (
              <SourceRow key={`${s.entity_id}-${i}`} source={s} />
            ))}
          </ul>

          {changedCount > 0 && (
            <p className="figure-mono text-[11px] text-faint">
              {changedCount}/{sources.length} cited notes changed since the pinned date
            </p>
          )}
          {(unpinned?.length ?? 0) > 0 && (
            <p className="text-[11px] leading-relaxed text-faint">
              Not covered: {unpinned!.slice(0, 3).map((u) => `“${u.title}”`).join(", ")}
              {unpinned!.length > 3 ? ` and ${unpinned!.length - 3} more` : ""} — changed after
              that date with no earlier snapshot.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
