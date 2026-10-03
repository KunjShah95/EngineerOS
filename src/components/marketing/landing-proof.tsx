"use client";

import { CalendarClock, FileText } from "lucide-react";

import { Reveal } from "@/components/marketing/reveal";

/**
 * The two things no one else in this category does.
 *
 * Both exist because the product refuses to let the AI bluff: one shows its
 * retrieval, the other refuses to answer about the past using today's text.
 * They are the most differentiated capabilities in the codebase and they were
 * missing from the page entirely, so they get their own section rather than
 * another feature card.
 */

const SOURCES = [
  { title: "Auth decision", mode: "semantic", score: "0.82", changed: false, snippet: "We chose session cookies over raw JWTs in the browser." },
  { title: "Architecture notes", mode: "semantic", score: "0.71", changed: false, snippet: "Supabase auth middleware runs on every server component." },
  { title: "Sprint checklist", mode: "keyword", score: "0.44", changed: true, snippet: "Ship onboarding empty states before the reindex." },
];

const PINNED = [
  { date: "2026-03-01", asked: "What did we decide about auth?", status: "answered", note: "3 sources · all as of 2026-03-01" },
  { date: "2026-05-14", asked: "What were the sprint priorities?", status: "answered", note: "2 sources · 1 edited since" },
  { date: "2026-01-08", asked: "What did I believe about the cache?", status: "partial", note: "1 source excluded · no earlier snapshot" },
];

export function LandingProof() {
  return (
    <section id="proof" className="relative border-y border-border-subtle py-16 md:py-28">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <Reveal className="max-w-2xl">
          <p className="label-mono">no black box</p>
          <h2 className="mt-5 font-serif-display text-[clamp(1.9rem,4vw,2.75rem)] font-normal leading-[1.06] tracking-[-0.02em] text-foreground">
            Most AI notes tools ask you to
            <br />
            trust the answer.
            <em className="not-italic font-light italic text-[color:var(--signal)]">
              {" "}This one shows its work.
            </em>
          </h2>
          <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-secondary">
            Two features exist purely because a confident wrong answer is worse
            than no answer — and because you should never have to take either on
            faith.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* ---- 1. Retrieval inspector ---- */}
          <Reveal delay={0}>
            <div className="flex h-full flex-col">
              <div className="mb-3 flex items-center gap-2.5">
                <FileText className="size-3.5 text-accent" strokeWidth={1.75} />
                <h3 className="label-mono text-[10px] text-foreground">
              why this answer
                </h3>
              </div>
              <p className="mb-5 max-w-sm text-sm leading-relaxed text-secondary">
                Every reply opens into the passages behind it: which retriever
                found each one, its relevance score, and the exact chunk that was
                quoted. Disagree with the answer? Check it in one click.
              </p>

              {/* A real rendering of the inspector, not an illustration of one. */}
              <div className="mt-auto overflow-hidden rounded-lg border border-border-default bg-elevated">
                <div className="flex items-center gap-2 border-b border-border-subtle bg-surface/60 px-3 py-2">
                  <span className="label-mono text-[9px]">3 sources</span>
                  <span className="label-mono ml-auto text-[9px] text-signal">
                    as of 2026-03-01
                  </span>
                </div>
                <ul className="divide-y divide-border-subtle">
                  {SOURCES.map((s) => (
                    <li key={s.title} className="bg-surface px-3 py-2.5">
                      <div className="mb-1 flex items-baseline justify-between gap-3">
                        <span className="truncate text-xs text-foreground">
                          {s.title}
                        </span>
                        <span className="figure-mono text-[10px] text-faint">
                          {s.score}
                        </span>
                      </div>
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="label-mono text-[9px]">{s.mode}</span>
                        {s.changed && (
                          <span className="label-mono text-[9px] text-warning">
                            edited since
                          </span>
                        )}
                      </div>
                      <p className="border-l border-border-subtle pl-2 text-[11px] leading-relaxed text-secondary">
                        {s.snippet}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>

          {/* ---- 2. Time travel ---- */}
          <Reveal delay={0.06}>
            <div className="flex h-full flex-col">
              <div className="mb-3 flex items-center gap-2.5">
                <CalendarClock className="size-3.5 text-signal" strokeWidth={1.75} />
                <h3 className="label-mono text-[10px] text-foreground">
                  ask as of a date
                </h3>
              </div>
              <p className="mb-5 max-w-sm text-sm leading-relaxed text-secondary">
                Pin a question to any past date and the assistant answers from
                your notes as they were written then. When a note changed since,
                the citation says so — and anything it can&rsquo;t reconstruct is
                named, never quietly answered from today&rsquo;s text.
              </p>

              <div className="mt-auto overflow-hidden rounded-lg border border-border-default bg-elevated">
                <div className="flex items-center gap-2 border-b border-border-subtle bg-surface/60 px-3 py-2">
                  <span className="label-mono text-[9px]">history</span>
                  <span className="label-mono ml-auto text-[9px] text-signal">
                    pinned
                  </span>
                </div>
                <ul className="divide-y divide-border-subtle">
                  {PINNED.map((p) => (
                    <li key={p.date} className="rail-signal bg-surface px-3 py-2.5">
                      <div className="mb-1 flex items-baseline justify-between gap-3">
                        <span className="truncate text-xs text-foreground">
                          {p.asked}
                        </span>
                        <span className="figure-mono text-[10px] text-signal">
                          {p.date}
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-secondary">
                        {p.note}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
