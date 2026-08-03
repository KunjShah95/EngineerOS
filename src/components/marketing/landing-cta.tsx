"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/marketing/reveal";

export function LandingCta() {
  return (
    <section id="cta" className="relative overflow-hidden py-16 md:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border-subtle)_1px,transparent_1px),linear-gradient(to_bottom,var(--border-subtle)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black,transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[320px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(79,70,229,0.18),rgba(30,64,175,0.12)_55%,transparent_75%)] blur-3xl"
      />

      <Reveal className="mx-auto w-full max-w-3xl px-4 text-center sm:px-6">
        <p className="font-mono text-[11px] tracking-widest text-accent uppercase">
          No setup debt
        </p>
        <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl">
          Start capturing everything today.
        </h2>
        <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-secondary">
          Your first note takes ten seconds. Your workspace, your data, and
          your daily rhythm follow from there.
        </p>

        <div className="mt-9">
          <Link href="/register">
            <Button
              size="lg"
              className="h-12 px-8 text-base shadow-[0_0_40px_-8px_var(--accent)]"
            >
              Get started free
              <ArrowRight className="size-4" strokeWidth={1.75} />
            </Button>
          </Link>
          <p className="mt-4 font-mono text-[11px] tracking-wide text-faint uppercase">
            No credit card · Self-hosted data
          </p>
        </div>
      </Reveal>
    </section>
  );
}
