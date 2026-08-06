"use client";

import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ChevronDown, ChevronRight, RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";
import { diffMarkdown, diffStats, type DiffLine } from "@/lib/markdown-diff";
import type { NoteVersion } from "@/types/database";

const DRAFT_ID = "__draft__";

interface VersionTimelineProps {
  /** Newest first (matches the query ordering). */
  versions: NoteVersion[];
  /** Live editor state, diffed against the newest snapshot. */
  currentTitle: string;
  currentBody: string;
  onRestore: (v: NoteVersion) => void;
}

/**
 * Visual diff + timeline of a note's version history.
 *
 * The top node is the *working draft* — the live editor diffed against the
 * newest snapshot — so unsaved changes are visible at a glance. Below it,
 * each saved version expands into a GitHub-style diff (word-level highlights)
 * against the snapshot that preceded it. Version body diffs are computed
 * lazily on first expand so opening history on a large note stays cheap.
 */
export function VersionTimeline({
  versions,
  currentTitle,
  currentBody,
  onRestore,
}: VersionTimelineProps) {
  const latest = versions[0];
  const [expanded, setExpanded] = useState<Set<string>>(new Set([DRAFT_ID]));

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // The draft's diff feeds its +N/−M stats, so it's computed eagerly — it's a
  // single diff, unlike the per-version ones (which stay lazy until expanded).
  const draftDiff = useMemo(
    () => (latest ? diffMarkdown(latest.body_markdown, currentBody) : null),
    [latest, currentBody]
  );
  const draftHasChanges =
    (draftDiff?.added ?? 0) + (draftDiff?.removed ?? 0) > 0 ||
    (latest ? currentTitle !== latest.title : false);

  // Cheap metadata per version: stats come from diffStats (no word-diff work),
  // while full body diffs stay lazy in VersionDiff until a node is expanded.
  const versionMeta = useMemo(
    () =>
      versions.map((v, i) => {
        const older = versions[i + 1];
        return {
          version: v,
          older: older ?? null,
          titleChanged: older ? older.title !== v.title : false,
          stats: diffStats(older?.body_markdown ?? "", v.body_markdown),
        };
      }),
    [versions]
  );

  if (versions.length === 0) {
    return (
      <div className="rounded-lg border border-border-subtle bg-surface p-5">
        <p className="mb-1 text-xs font-semibold text-secondary uppercase tracking-wide">
          Version history (0)
        </p>
        <p className="text-sm text-faint">
          No saved versions yet — click the clock icon in the toolbar to save a snapshot.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-5">
      <p className="mb-4 text-xs font-semibold text-secondary uppercase tracking-wide">
        Version history ({versions.length})
      </p>

      <ol className="list-none">
        {/* Working draft — live editor vs newest snapshot */}
        <li>
          <TimelineNode
            dotClassName="bg-accent"
            title="Working draft"
            subtitle="just now"
            stats={{
              added: draftDiff?.added ?? 0,
              removed: draftDiff?.removed ?? 0,
            }}
            expanded={expanded.has(DRAFT_ID)}
            onToggle={() => toggle(DRAFT_ID)}
          >
            {draftHasChanges ? (
              <VersionDiff
                olderBody={latest.body_markdown}
                newerBody={currentBody}
                titleChanged={latest ? currentTitle !== latest.title : false}
                oldTitle={latest.title}
                newTitle={currentTitle}
              />
            ) : (
              <p className="px-3 pb-3 text-sm text-faint">
                No unsaved changes — the editor is up to date with the latest snapshot.
              </p>
            )}
          </TimelineNode>
        </li>

        {/* Saved versions, newest first */}
        {versionMeta.map(({ version, older, titleChanged, stats }, i) => (
          <li key={version.id}>
            <TimelineNode
              title={version.title}
              subtitle={formatDistanceToNow(new Date(version.created_at), { addSuffix: true })}
              meta={new Date(version.created_at).toLocaleString()}
              stats={stats}
              expanded={expanded.has(version.id)}
              onToggle={() => toggle(version.id)}
              onRestore={() => onRestore(version)}
              isLast={i === versionMeta.length - 1}
            >
              {expanded.has(version.id) && (
                <VersionDiff
                  olderBody={older?.body_markdown ?? ""}
                  newerBody={version.body_markdown}
                  titleChanged={titleChanged}
                  oldTitle={older?.title ?? ""}
                  newTitle={version.title}
                />
              )}
            </TimelineNode>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Body diff for one node — mounts only when expanded, so it computes lazily. */
function VersionDiff({
  olderBody,
  newerBody,
  titleChanged,
  oldTitle,
  newTitle,
}: {
  olderBody: string;
  newerBody: string;
  titleChanged: boolean;
  oldTitle: string;
  newTitle: string;
}) {
  const diff = useMemo(() => diffMarkdown(olderBody, newerBody), [olderBody, newerBody]);
  return (
    <div
      role="group"
      aria-label="Diff against previous version"
      className="overflow-hidden rounded-md border border-border-subtle"
    >
      {titleChanged && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border-subtle bg-base px-3 py-2 text-xs">
          <span className="text-faint">Title:</span>
          <span className="text-danger line-through">{oldTitle}</span>
          <span className="text-faint">→</span>
          <span className="text-success">{newTitle}</span>
        </div>
      )}
      <div className="max-h-96 overflow-y-auto bg-base py-1 font-mono text-[13px] leading-6">
        {diff.lines.map((line, i) => (
          <DiffRow key={i} line={line} />
        ))}
      </div>
    </div>
  );
}

function TimelineNode({
  dotClassName,
  title,
  subtitle,
  meta,
  stats,
  expanded,
  onToggle,
  onRestore,
  isLast,
  children,
}: {
  dotClassName?: string;
  title: string;
  subtitle: string;
  meta?: string;
  stats: { added: number; removed: number };
  expanded: boolean;
  onToggle: () => void;
  onRestore?: () => void;
  isLast?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex gap-3">
      {/* Timeline rail */}
      <div className="flex w-4 shrink-0 flex-col items-center">
        <span
          className={cn(
            "mt-1.5 size-2 shrink-0 rounded-full ring-2 ring-surface",
            dotClassName ?? "bg-border-default"
          )}
          aria-hidden
        />
        {!isLast && <span className="w-px flex-1 bg-border-subtle" aria-hidden />}
      </div>

      <div className="min-w-0 flex-1 pb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-0.5 text-left transition-colors hover:bg-surface-hover"
          >
            {expanded ? (
              <ChevronDown className="size-3.5 shrink-0 text-faint" strokeWidth={1.75} />
            ) : (
              <ChevronRight className="size-3.5 shrink-0 text-faint" strokeWidth={1.75} />
            )}
            <span className="truncate text-sm font-medium text-foreground">{title}</span>
            <span className="shrink-0 text-xs text-faint">{subtitle}</span>
            {meta ? (
              <span className="hidden shrink-0 text-[11px] text-faint sm:inline">· {meta}</span>
            ) : null}
          </button>

          {stats.added > 0 && (
            <span className="shrink-0 rounded bg-success/10 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-success">
              +{stats.added}
            </span>
          )}
          {stats.removed > 0 && (
            <span className="shrink-0 rounded bg-danger/10 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-danger">
              −{stats.removed}
            </span>
          )}

          {onRestore && (
            <button
              type="button"
              onClick={onRestore}
              aria-label="Restore this version"
              className="inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent-muted"
            >
              <RotateCcw className="size-3" strokeWidth={1.75} />
              Restore
            </button>
          )}
        </div>

        {expanded && <div className="mt-2">{children}</div>}
      </div>
    </div>
  );
}

function DiffRow({ line }: { line: DiffLine }) {
  const sign = line.kind === "added" ? "+" : line.kind === "removed" ? "−" : " ";
  const rowClass =
    line.kind === "added"
      ? "bg-success/10 text-success"
      : line.kind === "removed"
        ? "bg-danger/10 text-danger"
        : "text-secondary";
  return (
    <div className={cn("flex whitespace-pre-wrap break-words px-3", rowClass)}>
      <span className="mr-2 w-3 shrink-0 select-none text-right opacity-70" aria-hidden>
        {sign}
      </span>
      {line.segments && line.segments.length > 0 ? (
        <span>
          {line.segments.map((s, i) => (
            <span
              key={i}
              className={cn(
                s.kind === "added" && "rounded-sm bg-success/25",
                s.kind === "removed" && "rounded-sm bg-danger/25"
              )}
            >
              {s.text}
            </span>
          ))}
        </span>
      ) : (
        <span>{line.text}</span>
      )}
    </div>
  );
}
