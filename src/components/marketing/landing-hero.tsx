"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { Button } from "@/components/ui/button";

const EASE: [number, number, number, number] = [0.21, 0.47, 0.32, 0.98];

export interface BootLine {
  cmd: string;
  out: string;
  tone?: "ok" | "signal";
}

/**
 * The terminal lines are computed on the server from the real curriculum, so
 * the numbers on the landing page are the numbers a bot would get back.
 */
export function LandingHero({ lines }: { lines: BootLine[] }) {
  return (
    <section className="relative overflow-hidden pt-20 pb-16 md:pt-28 md:pb-24">
      <div
        aria-hidden
        className="bg-blueprint pointer-events-none absolute inset-0 -z-20 opacity-70 [mask-image:radial-gradient(ellipse_80%_70%_at_50%_0%,black,transparent)] [background-size:72px_72px]"
      />

      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
        >
          <p className="label-mono">System design · AI engineering · RAG</p>

          <h1 className="mt-6 font-serif-display text-[clamp(2.8rem,6.4vw,4.6rem)] font-normal leading-[0.98] tracking-[-0.02em] text-foreground">
            Design systems
            <br />
            that hold up
            <br />
            <em className="font-light italic text-[color:var(--signal)]">under load.</em>
          </h1>

          <p className="mt-7 max-w-lg text-[15px] leading-relaxed text-secondary">
            Trade-off-first lessons on system design, AI engineering and a complete RAG course, wired into a map of what
            to learn before what. Then a workspace to keep your notes, decisions and projects, and an open MCP server so
            your agents can use all of it.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/learn">
              <Button size="lg" className="w-full sm:w-auto">
                Start free
                <ArrowRight className="size-4" strokeWidth={1.75} />
              </Button>
            </Link>
            <Link href="/#plans">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                See plans
              </Button>
            </Link>
            <Link
              href="/connect"
              className="rounded-md px-1 py-2 text-sm font-medium text-secondary underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:px-3"
            >
              Connect your bots
            </Link>
          </div>

          <p className="figure-mono mt-6 border-l border-border-subtle pl-3 text-[11px] leading-relaxed tracking-wide text-faint">
            Every lesson free. No sign-up to learn. Workspace plans from $0.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
        >
          <AgentTerminal lines={lines} />
        </motion.div>
      </div>
    </section>
  );
}

function AgentTerminal({ lines }: { lines: BootLine[] }) {
  const prefersReducedMotion = useReducedMotion();
  const [step, setStep] = useState(prefersReducedMotion ? lines.length : 0);

  useEffect(() => {
    if (prefersReducedMotion || step >= lines.length) return;
    const t = setTimeout(() => setStep((s) => s + 1), step === 0 ? 700 : 950);
    return () => clearTimeout(t);
  }, [step, prefersReducedMotion, lines.length]);

  const done = step >= lines.length;

  return (
    <div className="rounded-lg border border-border-subtle bg-elevated shadow-[0_28px_70px_-40px_rgba(0,0,0,0.9)]">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2.5">
        <span className="font-mono text-[10px] tracking-[0.16em] text-faint uppercase">agent — mcp session</span>
        <span className="flex items-center gap-1.5 font-mono text-[10px] text-faint">
          <span
            className={"size-1.5 rounded-full transition-colors duration-500 " + (done ? "bg-success" : "bg-warning")}
          />
          {done ? "connected" : "connecting"}
        </span>
      </div>

      <div className="min-h-[17rem] space-y-3 p-4 font-mono text-[12px] leading-relaxed sm:p-5" aria-label="Example agent session">
        {lines.slice(0, Math.max(step, 1)).map((line, i) => (
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
                className={"mt-1 pl-4 text-[11px] break-words " + (line.tone === "signal" ? "text-signal" : "text-secondary")}
              >
                {line.out}
              </motion.p>
            ) : null}
          </motion.div>
        ))}
        <p className="flex items-center gap-2 text-foreground" aria-hidden>
          <span className="text-signal">$</span>
          <span className="inline-block h-3.5 w-[7px] bg-signal motion-safe:animate-pulse" />
        </p>
      </div>
    </div>
  );
}
