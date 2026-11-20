"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, X } from "lucide-react";

import { TRACKS, getTopic, type TrackId } from "@/content/learn";
import { buildGraph, layoutGraph, pathTo, readyToLearn, unlocks } from "@/lib/learn/graph";
import { cn } from "@/lib/utils";
import { LevelMark, TRACK_STYLE, TrackTag } from "./ui";
import { useProgress } from "./use-progress";

const NODE_W = 196;
const NODE_H = 56;
const TRACK_LABEL = Object.fromEntries(TRACKS.map((t) => [t.id, t.title])) as Record<TrackId, string>;

function descendantsOf(id: string, edges: { from: string; to: string }[]): Set<string> {
  const out = new Set<string>();
  const queue = [id];
  while (queue.length) {
    const cur = queue.pop()!;
    for (const e of edges) {
      if (e.from === cur && !out.has(e.to)) {
        out.add(e.to);
        queue.push(e.to);
      }
    }
  }
  return out;
}

export function KnowledgeMap() {
  const graph = useMemo(() => buildGraph(), []);
  const layout = useMemo(
    () => layoutGraph(graph, { colWidth: 244, rowHeight: 76, padX: 20, padY: 20 }),
    [graph]
  );
  const pos = useMemo(() => new Map(layout.nodes.map((n) => [n.id, n])), [layout]);

  const { completed, toggle } = useProgress();
  const [selected, setSelected] = useState<string | null>(null);
  const [focusTrack, setFocusTrack] = useState<TrackId | "all">("all");

  const ready = useMemo(() => new Set(readyToLearn(completed).map((t) => t.id)), [completed]);

  const related = useMemo(() => {
    if (!selected) return null;
    const ancestors = new Set(pathTo(selected).map((t) => t.id));
    const downstream = descendantsOf(selected, graph.edges);
    downstream.add(selected);
    return { ancestors, downstream };
  }, [selected, graph.edges]);

  const selectedTopic = selected ? getTopic(selected) : undefined;
  const studyPath = selected ? pathTo(selected) : [];
  const remainingMinutes = studyPath.filter((t) => !completed.has(t.id)).reduce((s, t) => s + t.minutes, 0);

  const nodeState = (id: string, track: TrackId) => {
    const inTrack = focusTrack === "all" || focusTrack === track;
    const inSelection = !related || related.ancestors.has(id) || related.downstream.has(id);
    return { dim: !inTrack || !inSelection };
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]" onKeyDown={(e) => e.key === "Escape" && setSelected(null)}>
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] text-secondary">
          <div className="flex items-center gap-2" role="group" aria-label="Highlight a track">
            {(["all", ...TRACKS.map((t) => t.id)] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={focusTrack === t}
                onClick={() => setFocusTrack(t)}
                className={cn(
                  "rounded-full border px-3 py-1 tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                  focusTrack === t
                    ? "border-foreground bg-foreground text-[color:var(--bg-base)]"
                    : "border-border-subtle hover:border-default hover:text-foreground"
                )}
              >
                {t === "all" ? "All" : TRACK_LABEL[t]}
              </button>
            ))}
          </div>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-sm border border-signal bg-signal-muted" /> done
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-sm border border-dashed border-signal" /> ready to learn
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-px w-4 border-t border-dashed border-faint" /> cross-track
          </span>
        </div>

        <div
          className="overflow-auto rounded-lg border border-border-subtle bg-surface/50"
          style={{ maxHeight: "min(72vh, 760px)" }}
          role="region"
          aria-label="Knowledge map. Scroll to explore, select a topic for details."
          tabIndex={0}
        >
          <div className="relative" style={{ width: layout.width, height: layout.height }}>
            <svg
              aria-hidden
              width={layout.width}
              height={layout.height}
              className="pointer-events-none absolute inset-0"
            >
              {graph.edges.map((e) => {
                const a = pos.get(e.from)!;
                const b = pos.get(e.to)!;
                const x1 = a.x + NODE_W;
                const y1 = a.y + NODE_H / 2;
                const x2 = b.x;
                const y2 = b.y + NODE_H / 2;
                const mid = (x2 - x1) / 2;
                const active =
                  related &&
                  ((related.ancestors.has(e.from) && related.ancestors.has(e.to)) ||
                    (related.downstream.has(e.from) && related.downstream.has(e.to)));
                return (
                  <path
                    key={`${e.from}-${e.to}`}
                    d={`M ${x1} ${y1} C ${x1 + mid} ${y1}, ${x2 - mid} ${y2}, ${x2} ${y2}`}
                    fill="none"
                    stroke={active ? "var(--text-primary)" : "var(--border-default)"}
                    strokeWidth={active ? 1.5 : 1}
                    strokeDasharray={e.crossTrack ? "4 4" : undefined}
                    opacity={related && !active ? 0.25 : 1}
                  />
                );
              })}
            </svg>

            {layout.nodes.map((n) => {
              const done = completed.has(n.id);
              const isReady = ready.has(n.id);
              const { dim } = nodeState(n.id, n.track);
              const style = TRACK_STYLE[n.track];
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setSelected((s) => (s === n.id ? null : n.id))}
                  aria-pressed={selected === n.id}
                  aria-label={`${n.title}. ${TRACK_LABEL[n.track]}, ${n.level}.${done ? " Completed." : isReady ? " Ready to learn." : ""}`}
                  style={{ left: n.x, top: n.y, width: NODE_W, height: NODE_H }}
                  className={cn(
                    "absolute flex flex-col justify-center rounded-md border bg-elevated px-3 text-left transition-[opacity,border-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                    done
                      ? "border-signal bg-signal-muted"
                      : isReady
                        ? "border-dashed border-signal"
                        : "border-border-subtle hover:border-default",
                    selected === n.id && "ring-2 ring-foreground",
                    dim && "opacity-25"
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", style.dot)} />
                    {done ? <Check aria-hidden className="size-3 text-signal" strokeWidth={3} /> : null}
                  </span>
                  <span className="mt-0.5 line-clamp-2 text-[12px] leading-tight font-medium text-foreground">
                    {n.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <aside className="rounded-lg border border-border-subtle bg-surface p-5 lg:sticky lg:top-24 lg:self-start" aria-live="polite">
        {selectedTopic ? (
          <div>
            <div className="flex items-start justify-between gap-3">
              <TrackTag track={selectedTopic.track} label={TRACK_LABEL[selectedTopic.track]} />
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="-m-1 rounded p-1 text-faint hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                aria-label="Clear selection"
              >
                <X className="size-4" strokeWidth={1.75} />
              </button>
            </div>
            <h2 className="mt-3 font-serif-display text-2xl leading-snug tracking-[-0.01em] text-foreground">
              {selectedTopic.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-secondary">{selectedTopic.summary}</p>
            <div className="mt-3 flex items-center gap-4">
              <LevelMark level={selectedTopic.level} />
              <span className="font-mono text-[10px] text-faint">{selectedTopic.minutes} min</span>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href={`/learn/${selectedTopic.track}/${selectedTopic.id}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                Open lesson <ArrowRight className="size-4" strokeWidth={1.75} />
              </Link>
              <button
                type="button"
                onClick={() => toggle(selectedTopic.id)}
                aria-pressed={completed.has(selectedTopic.id)}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border-subtle px-3.5 text-sm text-secondary transition-colors hover:border-default hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <Check className="size-4" strokeWidth={1.75} />
                {completed.has(selectedTopic.id) ? "Done" : "Mark done"}
              </button>
            </div>

            <h3 className="label-mono mt-6">Study path</h3>
            <p className="mt-1 text-xs text-faint">
              {studyPath.length} {studyPath.length === 1 ? "topic" : "topics"} · about {remainingMinutes} min left
            </p>
            <ol className="mt-3 space-y-1.5">
              {studyPath.map((t, i) => (
                <li key={t.id} className="flex items-baseline gap-2 text-sm">
                  <span className="figure-mono w-5 shrink-0 text-right text-[11px] text-faint">{i + 1}</span>
                  <button
                    type="button"
                    onClick={() => setSelected(t.id)}
                    className={cn(
                      "text-left underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                      completed.has(t.id) ? "text-signal" : t.id === selected ? "text-foreground" : "text-secondary"
                    )}
                  >
                    {t.title}
                  </button>
                </li>
              ))}
            </ol>

            {unlocks(selectedTopic.id).length > 0 ? (
              <>
                <h3 className="label-mono mt-6">Unlocks</h3>
                <ul className="mt-2 space-y-1.5">
                  {unlocks(selectedTopic.id).map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(t.id)}
                        className="text-left text-sm text-secondary underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                      >
                        {t.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        ) : (
          <div>
            <h2 className="font-serif-display text-2xl leading-snug tracking-[-0.01em] text-foreground">
              {completed.size} of {graph.nodes.length} done
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-secondary">
              Select any topic to light up what it depends on and what it unlocks. Progress is saved in this browser.
            </p>
            <h3 className="label-mono mt-6">Ready to learn</h3>
            <ul className="mt-2 space-y-1.5">
              {[...ready].slice(0, 8).map((id) => (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => setSelected(id)}
                    className="text-left text-sm text-secondary underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    {getTopic(id)?.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}
