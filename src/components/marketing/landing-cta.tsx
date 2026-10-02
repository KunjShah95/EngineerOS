"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/marketing/reveal";

export function LandingCta() {
  return (
    <section id="cta" className="relative overflow-hidden border-t border-border-subtle py-16 md:py-24">
      {/* Same blueprint grid as the hero — the page closes where it opened */}
      <div
        aria-hidden
        className="bg-blueprint pointer-events-none absolute inset-0 -z-10 opacity-70 [mask-image:radial-gradient(ellipse_70%_100%_at_50%_100%,black,transparent)] [background-size:72px_72px]"
      />

      <Reveal className="mx-auto w-full max-w-2xl px-4 text-center sm:px-6">
        <p className="label-mono">
          No setup debt
        </p>
        <h2 className="mt-5 font-serif-display text-[clamp(2rem,4.5vw,3rem)] font-normal leading-[1.04] tracking-[-0.02em] text-foreground">
          Your first note takes
          <br />
          <em className="not-italic font-light italic text-[color:var(--signal)]">
            ten seconds.
          </em>
        </h2>
        <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-secondary">
          The workspace, the index, and the daily rhythm follow from there. No
          templates to pick, no schema to design.
        </p>

        <div className="mt-9 flex flex-col items-center gap-4">
          <Link href="/register">
            <Button size="lg">
              Create a workspace
              <ArrowRight className="size-4" strokeWidth={1.75} />
            </Button>
          </Link>
          <p className="figure-mono text-[11px] tracking-wide text-faint">
            No credit card · Your own Supabase
          </p>
        </div>
      </Reveal>
    </section>
  );
}
