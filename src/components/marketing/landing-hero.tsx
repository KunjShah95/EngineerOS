"use client";

import Link from "next/link";
import { ArrowRight, Check, CornerDownRight, FileText, Search, Sparkles } from "lucide-react";
import { motion } from "motion/react";

import { Button } from "@/components/ui/button";

const EASE: [number, number, number, number] = [0.21, 0.47, 0.32, 0.98];

/**
 * Illustrative workspace. Every name, note and answer here is sample content and
 * is labelled as such on the canvas. Nothing is pulled from a real account.
 */
const NAV = [
  { label: "Today", active: true },
  { label: "Tasks", count: 4 },
  { label: "Notes", count: 12 },
  { label: "Decisions", count: 3 },
  { label: "Projects", count: 2 },
];

export function LandingHero() {
  return (
    <section className="relative overflow-hidden pt-16 pb-16 md:pt-24 md:pb-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[620px] bg-[radial-gradient(60%_50%_at_50%_0%,color-mix(in_oklab,var(--accent)_14%,transparent),transparent)]"
      />

      <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 text-center sm:px-6">
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
          className="font-serif-display text-[clamp(2.6rem,6vw,4.75rem)] leading-[1.02] font-normal tracking-[-0.025em] text-foreground text-balance"
        >
          Your work is already connected.
          <br />
          <span className="text-secondary">Now you can see how.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.08, ease: EASE }}
          className="mt-6 max-w-xl text-[15px] leading-relaxed text-secondary text-pretty"
        >
          EngineerOS is a todo and productivity workspace for engineers. Tasks, a daily note that rolls unfinished work
          forward, and a focus timer, with every task linked to the notes and decisions behind it.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.16, ease: EASE }}
          className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center"
        >
          <Link href="/register">
            <Button size="lg" className="w-full sm:w-auto">
              Start free
              <ArrowRight className="size-4" strokeWidth={1.75} />
            </Button>
          </Link>
          <Link href="/tour">
            <Button size="lg" variant="secondary" className="w-full sm:w-auto">
              Try the tour, no account
            </Button>
          </Link>
        </motion.div>

        <p className="mt-5 text-xs text-faint">Free to start. No credit card. Your data stays in your own Supabase project.</p>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.24, ease: EASE }}
          className="mt-16 w-full"
        >
          <WorkspaceCanvas />
        </motion.div>
      </div>
    </section>
  );
}

function WorkspaceCanvas() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border-subtle bg-elevated text-left shadow-[0_40px_90px_-50px_rgba(0,0,0,0.85)]">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2.5">
        <div className="flex items-center gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-border-subtle" />
          <span className="size-2.5 rounded-full bg-border-subtle" />
          <span className="size-2.5 rounded-full bg-border-subtle" />
        </div>
        <span className="truncate font-mono text-[10px] tracking-[0.14em] text-faint uppercase">
          Sample workspace · illustrative
        </span>
        <span className="w-12" aria-hidden />
      </div>

      <div className="grid md:grid-cols-[180px_1fr_340px]">
        {/* Left: navigation */}
        <nav aria-label="Sample navigation" className="hidden border-r border-border-subtle p-3 md:block">
          <ul className="space-y-0.5">
            {NAV.map((item) => (
              <li
                key={item.label}
                className={
                  "flex items-center justify-between rounded-md px-2.5 py-1.5 text-[13px] " +
                  (item.active ? "bg-muted text-foreground" : "text-secondary")
                }
              >
                {item.label}
                {item.count ? <span className="font-mono text-[10px] text-faint">{item.count}</span> : null}
              </li>
            ))}
          </ul>
        </nav>

        {/* Centre: an open decision note with its linked task */}
        <div className="min-w-0 border-r border-border-subtle p-5 sm:p-6">
          <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.14em] text-faint uppercase">
            <FileText className="size-3.5" strokeWidth={1.75} /> Decision · 2026-10-14
          </p>
          <h2 className="mt-3 font-serif-display text-2xl leading-tight text-foreground">Queue: Postgres, not Redis</h2>
          <div className="mt-4 space-y-3 text-[13px] leading-relaxed text-secondary">
            <p>
              Volume stays well under what one Postgres instance handles. Adding Redis means a second system to back up,
              monitor and secure. <span className="text-foreground">SKIP LOCKED</span> covers the worker pattern we need.
            </p>
            <p>Revisit if sustained throughput or fan-out outgrows the current instance.</p>
          </div>
          <div className="mt-5 flex items-center gap-3 rounded-md border border-border-subtle bg-base px-3 py-2.5">
            <CornerDownRight className="size-3.5 text-faint" strokeWidth={1.75} aria-hidden />
            <span className="text-[13px] text-foreground">Write ADR for queue choice</span>
            <span className="ml-auto font-mono text-[10px] text-faint">Linked · due Fri</span>
          </div>
        </div>

        {/* Right: assistant rail with citations */}
        <aside aria-label="Sample assistant" className="flex flex-col gap-4 bg-base/60 p-5 sm:p-6">
          <p className="flex items-center gap-2 text-[13px] font-medium text-foreground">
            <Sparkles className="size-3.5 text-accent" strokeWidth={1.75} aria-hidden /> Ask your workspace
          </p>

          <div className="rounded-md border border-border-subtle bg-elevated px-3 py-2.5 text-[13px] text-foreground">
            <Search className="mb-1.5 inline size-3 text-faint" strokeWidth={1.75} aria-hidden /> Why did we drop Redis?
          </div>

          <div className="space-y-3">
            <p className="text-[13px] leading-relaxed text-secondary">
              We kept the queue on Postgres. The volume fits one instance, and Redis would add a second system to run.
            </p>
            <div className="flex flex-wrap gap-1.5">
              <SourceChip label="Decision · Queue" />
              <SourceChip label="Standup · 14 Oct" />
            </div>
            <p className="flex items-center gap-1.5 font-mono text-[10px] text-success">
              <Check className="size-3" strokeWidth={2.5} aria-hidden /> Answer grounded in 2 notes
            </p>
          </div>

          <div className="mt-auto rounded-md border border-dashed border-border-subtle px-3 py-2.5">
            <p className="font-mono text-[10px] tracking-[0.14em] text-faint uppercase">Next</p>
            <p className="mt-1 text-[13px] text-foreground">Create task: update the ADR status to accepted</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function SourceChip({ label }: { label: string }) {
  return (
    <span className="rounded-[4px] border border-border-subtle bg-muted px-2 py-0.5 font-mono text-[11px] text-secondary">
      {label}
    </span>
  );
}
