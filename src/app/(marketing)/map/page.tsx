import { KnowledgeMap } from "@/components/learn/KnowledgeMap";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { ALL_TOPICS } from "@/content/learn";
import { buildGraph } from "@/lib/learn/graph";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "The engineering knowledge map",
  description:
    "An interactive prerequisite map of system design and AI engineering topics. See what to learn first, what each topic unlocks, and track your progress.",
  path: "/map",
});

export default function MapPage() {
  const { edges } = buildGraph();
  const cross = edges.filter((e) => e.crossTrack).length;
  return (
    <MarketingShell>
      <section className="mx-auto w-full max-w-6xl px-4 pt-14 pb-8 sm:px-6 md:pt-20">
        <p className="label-mono">Map</p>
        <h1 className="mt-5 max-w-3xl font-serif-display text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.02] tracking-[-0.02em] text-foreground">
          Everything connects to something you should learn first.
        </h1>
        <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-secondary">
          {ALL_TOPICS.length} topics, {edges.length} prerequisite links, {cross} of them crossing between tracks, because agents need idempotent tools, RAG leans on search and caching, and production RAG needs multi-tenancy. The same graph is available to
          bots at <code className="font-mono text-[13px] text-foreground">/api/v1/map</code>.
        </p>
      </section>
      <section className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
        <KnowledgeMap />
      </section>
    </MarketingShell>
  );
}
