"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/marketing/reveal";
import { ShaderCanvas } from "@/components/marketing/shader-canvas";

export function LandingCta() {
  return (
    <section id="cta" className="relative overflow-hidden py-16 md:py-28">
      {/* Shader canvas at reduced intensity — feels like entering the system */}
      <ShaderCanvas
        className="pointer-events-none absolute inset-0 -z-20 h-full w-full"
        speed={0.7}
      />

      {/* Top + bottom fades blend with surrounding sections */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-32 bg-gradient-to-b from-[var(--bg-base)] to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-[var(--bg-base)] to-transparent"
      />

      {/* Center darkening for text readability */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_60%_70%_at_50%_50%,black,transparent)] bg-[rgba(8,10,18,0.50)]"
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
              className="h-12 px-8 text-base shadow-[0_0_60px_-8px_var(--accent),0_0_120px_-20px_rgba(124,58,237,0.4)]"
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
