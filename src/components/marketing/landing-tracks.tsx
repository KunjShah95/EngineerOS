import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { LevelMark, TRACK_STYLE } from "@/components/learn/ui";
import { Reveal } from "@/components/marketing/reveal";
import { TRACKS } from "@/content/learn";
import { cn } from "@/lib/utils";

export function LandingTracks() {
  return (
    <section id="tracks" className="py-16 md:py-28">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <Reveal className="max-w-2xl">
          <p className="label-mono">Three tracks</p>
          <h2 className="mt-5 font-serif-display text-[clamp(1.9rem,4vw,2.75rem)] leading-[1.06] tracking-[-0.02em] text-foreground">
            The parts that decide whether it <em className="font-light italic text-signal">holds up.</em>
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-secondary">
            No buzzword tours. Each lesson names the trade-off, gives you questions to answer out loud, and where it
            helps, a small thing to build.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {TRACKS.map((track, i) => (
            <Reveal key={track.id} delay={i * 0.08}>
              <div className="flex h-full flex-col rounded-lg border border-border-subtle bg-surface p-6">
                <p className={cn("font-mono text-[10px] tracking-[0.16em] uppercase", TRACK_STYLE[track.id].text)}>
                  {track.topics.length} lessons
                </p>
                <h3 className="mt-3 font-serif-display text-3xl tracking-[-0.015em] text-foreground">{track.title}</h3>
                <p className="mt-1 text-sm text-foreground/80">{track.tagline}</p>
                <ul className="mt-5 flex-1 divide-y divide-border-subtle border-y border-border-subtle">
                  {track.topics.slice(0, 6).map((t) => (
                    <li key={t.id}>
                      <Link
                        href={`/learn/${t.track}/${t.id}`}
                        className="flex items-center justify-between gap-4 py-2.5 text-sm text-secondary transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                      >
                        <span>{t.title}</span>
                        <LevelMark level={t.level} className="hidden shrink-0 xl:inline-flex" />
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/learn/${track.id}`}
                  className="mt-5 inline-flex items-center gap-1.5 text-sm text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  All {track.topics.length} lessons <ArrowRight className="size-4" strokeWidth={1.75} />
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
