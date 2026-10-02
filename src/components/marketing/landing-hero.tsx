"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { Button } from "@/components/ui/button";

const EASE: [number, number, number, number] = [0.21, 0.47, 0.32, 0.98];

/** Boot lines for the signature terminal. Each resolves into a real workspace object. */
const BOOT = [
  { cmd: "engineeros init", out: "workspace ready · supabase://your-project", tone: "ok" },
  { cmd: "index --all", out: "47 notes · 128 tasks · 12 projects embedded", tone: "ok" },
  { cmd: "graph build", out: "214 wikilinks resolved · 0 orphans", tone: "ok" },
  { cmd: "ask \"how does auth work?\"", out: "3 sources cited → 0.82 / 0.71 / 0.44", tone: "signal" },
  { cmd: "ask --as-of 2026-03-01 \"what did we decide?\"", out: "answered as of 2026-03-01 · 1 note edited since", tone: "signal" },
];

export function LandingHero() {
  return (
    <section className="relative overflow-hidden pt-28 pb-16 md:pt-36 md:pb-24">
      {/* Blueprint grid — engineering paper, not a gradient blob */}
      <div
        aria-hidden
        className="bg-blueprint pointer-events-none absolute inset-0 -z-20 opacity-70 [mask-image:radial-gradient(ellipse_80%_70%_at_50%_0%,black,transparent)] [background-size:72px_72px]"
      />

      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        {/* ---- Left: the thesis ---- */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
        >
          <p className="label-mono">
            Notes · Tasks · Projects · Daily
          </p>

          <h1 className="mt-6 font-serif-display text-[clamp(2.6rem,6vw,4.25rem)] font-normal leading-[0.98] tracking-[-0.02em] text-foreground">
            Your work is already
            <br />
            connected.
            <br />
            <em className="not-italic font-light italic text-[color:var(--signal)]">
              Your tools aren&rsquo;t.
            </em>
          </h1>

          <p className="mt-7 max-w-md text-[15px] leading-relaxed text-secondary">
            EngineerOS keeps notes, tasks, projects, and daily entries in one
            indexed system. Ask a question in plain English and get an answer
            with citations back to the note it came from.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto">
                Create a workspace
                <ArrowRight className="size-4" strokeWidth={1.75} />
              </Button>
            </Link>
            <Link
              href="/login"
              className="rounded-md px-1 py-2 text-sm font-medium text-secondary underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:px-3"
            >
              Log in
            </Link>
          </div>

          <p className="figure-mono mt-6 border-l border-border-subtle pl-3 text-[11px] leading-relaxed tracking-wide text-faint">
            Free to start. Data lives in your own Supabase project.
          </p>
        </motion.div>

        {/* ---- Right: signature — the OS booting ---- */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
        >
          <BootTerminal />
        </motion.div>
      </div>
    </section>
  );
}

function BootTerminal() {
  const prefersReducedMotion = useReducedMotion();
  const [step, setStep] = useState(prefersReducedMotion ? BOOT.length : 0);

  useEffect(() => {
    if (prefersReducedMotion) return;
    if (step >= BOOT.length) return;
    const t = setTimeout(() => setStep((s) => s + 1), step === 0 ? 700 : 900);
    return () => clearTimeout(t);
  }, [step, prefersReducedMotion]);

  const done = step >= BOOT.length;

  return (
    <div className="rounded-lg border border-border-subtle bg-elevated shadow-[0_28px_70px_-40px_rgba(0,0,0,0.9)]">
      {/* Title bar — labelled, not three fake traffic lights */}
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2.5">
        <span className="font-mono text-[10px] tracking-[0.16em] text-faint uppercase">
          engineeros — session
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[10px] text-faint">
          <span
            className={
              "size-1.5 rounded-full transition-colors duration-500 " +
              (done ? "bg-success" : "bg-warning")
            }
          />
          {done ? "ready" : "booting"}
        </span>
      </div>

      <div className="space-y-3 p-4 font-mono text-[12px] leading-relaxed sm:p-5">
        {BOOT.slice(0, Math.max(step, 1)).map((line, i) => (
          <motion.div
            key={line.cmd}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            <p className="flex items-baseline gap-2 text-foreground">
              <span className="text-signal">$</span>
              <span className="break-all">{line.cmd}</span>
            </p>
            {i < step ? (
              <motion.p
                initial={prefersReducedMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.25 }}
                className={
                  "mt-1 pl-4 text-[11px] " +
                  (line.tone === "signal" ? "text-signal" : "text-secondary")
                }
              >
                {line.out}
              </motion.p>
            ) : null}
          </motion.div>
        ))}

        <p className="flex items-center gap-2 text-foreground">
          <span className="text-signal">$</span>
          <span
            aria-hidden
            className="inline-block h-3.5 w-[7px] bg-signal motion-safe:animate-pulse"
          />
        </p>
      </div>
    </div>
  );
}
