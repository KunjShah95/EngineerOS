import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { TRACK_STYLE } from "@/components/learn/ui";
import { Reveal } from "@/components/marketing/reveal";
import { buildGraph, layoutGraph } from "@/lib/learn/graph";

/** A small, static picture of the real graph. The interactive one lives at /map. */
export function LandingMap() {
  const graph = buildGraph();
  const layout = layoutGraph(graph, { colWidth: 74, rowHeight: 30, padX: 14, padY: 14 });
  const pos = new Map(layout.nodes.map((n) => [n.id, n]));
  const W = layout.width - 120;
  const H = layout.height - 14;
  const cross = graph.edges.filter((e) => e.crossTrack).length;

  return (
    <section id="map" className="border-y border-border-subtle bg-surface/40 py-16 md:py-28">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Reveal>
          <p className="label-mono">The map</p>
          <h2 className="mt-5 font-serif-display text-[clamp(1.9rem,4vw,2.75rem)] leading-[1.06] tracking-[-0.02em] text-foreground">
            See what depends on what.
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-secondary">
            Pick any topic and the map lights up its prerequisites and everything it unlocks, then gives you a study
            order with the minutes left. {cross} of the links cross between tracks, because agents need idempotent tools
            and RAG leans on caching.
          </p>
          <Link
            href="/map"
            className="mt-7 inline-flex items-center gap-1.5 text-sm text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            Open the interactive map <ArrowRight className="size-4" strokeWidth={1.75} />
          </Link>
        </Reveal>

        <Reveal delay={0.1}>
          <Link
            href="/map"
            aria-label="Open the interactive knowledge map"
            className="block rounded-lg border border-border-subtle bg-elevated p-4 transition-colors hover:border-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Prerequisite graph of ${graph.nodes.length} topics`}>
              {graph.edges.map((e) => {
                const a = pos.get(e.from)!;
                const b = pos.get(e.to)!;
                const x1 = a.x + 6;
                const x2 = b.x - 6;
                const mid = (x2 - x1) / 2;
                return (
                  <path
                    key={`${e.from}-${e.to}`}
                    d={`M ${x1} ${a.y + 6} C ${x1 + mid} ${a.y + 6}, ${x2 - mid} ${b.y + 6}, ${x2} ${b.y + 6}`}
                    fill="none"
                    stroke="var(--border-default)"
                    strokeWidth={1}
                    strokeDasharray={e.crossTrack ? "3 3" : undefined}
                  />
                );
              })}
              {layout.nodes.map((n) => (
                <circle key={n.id} cx={n.x} cy={n.y + 6} r={5} fill={TRACK_STYLE[n.track].fill} />
              ))}
            </svg>
            <p className="mt-3 flex items-center gap-4 font-mono text-[10px] text-faint">
              <span className="flex items-center gap-1.5"><span aria-hidden className="size-2 rounded-full bg-accent-hover" /> System Design</span>
              <span className="flex items-center gap-1.5"><span aria-hidden className="size-2 rounded-full bg-warning" /> AI Engineering</span>
              <span className="flex items-center gap-1.5"><span aria-hidden className="size-2 rounded-full bg-[color:var(--track-rag)]" /> RAG Engineering</span>
            </p>
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
