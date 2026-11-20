import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/marketing/reveal";
import { TRACKS } from "@/content/learn";

/**
 * The RAG course as a syllabus, not a feature grid.
 *
 * Everything here is derived from the curriculum data, so the module count,
 * lesson count and hours can never drift from what the course actually contains.
 */
function modulesOf(trackId: string) {
  const track = TRACKS.find((t) => t.id === trackId);
  if (!track) return [];
  const order: string[] = [];
  const byModule = new Map<string, { lessons: string[]; minutes: number; first: string }>();
  for (const t of track.topics) {
    const key = t.module ?? "Lessons";
    if (!byModule.has(key)) {
      order.push(key);
      byModule.set(key, { lessons: [], minutes: 0, first: t.id });
    }
    const m = byModule.get(key)!;
    m.lessons.push(t.title);
    m.minutes += t.minutes;
  }
  return order.map((name) => ({ name, ...byModule.get(name)! }));
}

export function LandingCourse() {
  const modules = modulesOf("rag-engineering");
  const track = TRACKS.find((t) => t.id === "rag-engineering");
  if (!track) return null;
  const lessonCount = track.topics.length;
  const hours = Math.round(track.topics.reduce((n, t) => n + t.minutes, 0) / 60);

  return (
    <section id="course" className="border-t border-border-subtle py-20 md:py-28">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <Reveal className="lg:sticky lg:top-24 lg:self-start">
          <p className="label-mono">The flagship course</p>
          <h2 className="mt-5 font-serif-display text-[clamp(2rem,4.2vw,3.1rem)] font-normal leading-[1.04] tracking-[-0.02em] text-foreground">
            Build a retrieval system
            <br />
            <em className="font-light italic text-[color:var(--track-rag)]">you can defend with numbers.</em>
          </h2>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-secondary">
            Most RAG tutorials end at a demo that answers three questions. This one ends at a system with a golden
            set, citations, permissions and a cost per answer, and a write-up that shows how you got there.
          </p>

          <dl className="mt-8 grid max-w-sm grid-cols-3 border-y border-border-subtle py-4">
            {[
              [String(modules.length), "modules"],
              [String(lessonCount), "lessons"],
              [`~${hours}h`, "to finish"],
            ].map(([v, l]) => (
              <div key={l}>
                <dt className="label-mono text-[10px]">{l}</dt>
                <dd className="figure-mono mt-1 text-2xl text-foreground tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/learn/rag-engineering/rag-when-and-why">
              <Button size="lg">
                Start lesson one, free
                <ArrowRight className="size-4" strokeWidth={1.75} />
              </Button>
            </Link>
            <Link
              href="/learn/rag-engineering"
              className="text-sm font-medium text-secondary underline-offset-4 hover:text-foreground hover:underline"
            >
              See every lesson
            </Link>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <ol className="border-t border-border-subtle">
            {modules.map((m, i) => {
              const capstone = m.name === "Capstone";
              return (
                <li
                  key={m.name}
                  className={
                    "grid grid-cols-[2.5rem_1fr_auto] gap-x-4 border-b border-border-subtle py-5 " +
                    (capstone ? "bg-[color:var(--signal-muted)]/40 px-4 -mx-4" : "")
                  }
                >
                  <span className="figure-mono pt-1 text-xs text-faint tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  <div className="min-w-0">
                    <h3 className="font-serif-display text-xl leading-snug text-foreground">
                      {capstone ? "Capstone: ship it" : m.name}
                    </h3>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-secondary">{m.lessons.join(" · ")}</p>
                  </div>
                  <span className="figure-mono pt-1.5 text-[11px] whitespace-nowrap text-faint tabular-nums">
                    {m.lessons.length} {m.lessons.length === 1 ? "lesson" : "lessons"} · {m.minutes} min
                  </span>
                </li>
              );
            })}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}
