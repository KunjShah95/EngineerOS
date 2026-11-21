"use client";

import { motion, useReducedMotion } from "motion/react";

const STACK = [
  "Next.js",
  "Supabase",
  "Postgres + pgvector",
  "Row-level security",
  "Tailwind CSS",
  "TypeScript",
  "OpenAI / Gemini",
  "Vercel",
  "Self-hosted",
];

/**
 * Quiet infinite marquee. Duplicated list + linear translate, pauses on hover.
 * No layout thrash: transform-only, collapsed under reduced motion.
 */
export function LandingStackMarquee() {
  const prefersReducedMotion = useReducedMotion();
  const row = [...STACK, ...STACK];

  return (
    <section className="border-y border-border-subtle bg-base py-5 overflow-hidden">
      <div className="relative mx-auto w-full max-w-6xl overflow-hidden px-4 sm:px-6">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-base to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-base to-transparent" />
        <motion.div
          className="flex w-max items-center gap-8"
          animate={prefersReducedMotion ? undefined : { x: ["0%", "-50%"] }}
          transition={
            prefersReducedMotion
              ? undefined
              : { duration: 28, ease: "linear", repeat: Infinity }
          }
        >
          {row.map((item, i) => (
            <span
              key={`${item}-${i}`}
              className="whitespace-nowrap font-mono text-[11px] tracking-[0.14em] text-faint uppercase"
            >
              {item}
              <span aria-hidden className="ml-8 text-border-default">
                /
              </span>
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
