import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { MarketingShell } from "@/components/marketing/marketing-shell";
import { TopicExplorer } from "@/components/learn/TopicExplorer";
import { TRACK_STYLE } from "@/components/learn/ui";
import { ALL_TOPICS, TRACKS } from "@/content/learn";
import { pageMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const metadata = pageMeta({
  title: "Learn system design and AI engineering",
  description:
    "Practical, trade-off-first lessons on system design and AI engineering: caching, sharding, queues, RAG, evals, agents, context and harness engineering, MCP.",
  path: "/learn",
});

export default function LearnPage() {
  return (
    <MarketingShell>
      <section className="mx-auto w-full max-w-6xl px-4 pt-14 pb-10 sm:px-6 md:pt-20">
        <p className="label-mono">Learn</p>
        <h1 className="mt-5 max-w-3xl font-serif-display text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.02] tracking-[-0.02em] text-foreground">
          Learn it the way you&rsquo;ll <em className="font-light text-signal italic">use</em> it.
        </h1>
        <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-secondary">
          {ALL_TOPICS.length} short lessons across three tracks, including a full RAG course. Each one is about trade-offs, ends with questions to
          answer out loud, and where it helps, a small build. Start anywhere, or follow the{" "}
          <Link href="/map" className="text-foreground underline underline-offset-4">
            map
          </Link>{" "}
          so prerequisites come first.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {TRACKS.map((t) => {
            const minutes = t.topics.reduce((s, x) => s + x.minutes, 0);
            return (
              <Link
                key={t.id}
                href={`/learn/${t.id}`}
                className="group rounded-lg border border-border-subtle bg-surface p-6 transition-colors hover:border-default hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <p className={cn("font-mono text-[10px] tracking-[0.16em] uppercase", TRACK_STYLE[t.id].text)}>
                  {t.topics.length} topics · ~{Math.round(minutes / 6) / 10} h
                </p>
                <h2 className="mt-3 font-serif-display text-3xl leading-tight tracking-[-0.015em] text-foreground">
                  {t.title}
                </h2>
                <p className="mt-1 text-sm text-foreground/80">{t.tagline}</p>
                <p className="mt-3 text-sm leading-relaxed text-secondary">{t.description}</p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm text-foreground">
                  Open track
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" strokeWidth={1.75} />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
        <TopicExplorer />
      </section>
    </MarketingShell>
  );
}
