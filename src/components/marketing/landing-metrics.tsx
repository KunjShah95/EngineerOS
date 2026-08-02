"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "motion/react";

import { Reveal } from "@/components/marketing/reveal";

const METRICS = [
  { value: 30, suffix: "", label: "Notes" },
  { value: 100, suffix: "", label: "Tasks" },
  { value: 5, suffix: "", label: "Projects" },
  { value: 7, suffix: "", label: "Daily notes" },
];

export function LandingMetrics() {
  return (
    <section className="border-y border-border-subtle bg-surface/40">
      <div className="mx-auto w-full max-w-6xl px-6 py-12">
        <Reveal>
          <p className="mb-8 text-center font-mono text-[11px] tracking-widest text-faint uppercase">
            A week of real use, comfortably
          </p>
          <dl className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {METRICS.map((metric) => (
              <div key={metric.label} className="text-center">
                <dd className="font-mono text-4xl font-medium tracking-tight text-foreground tabular-nums md:text-5xl">
                  <CountUp to={metric.value} suffix={metric.suffix} />
                </dd>
                <dt className="mt-2 text-sm text-secondary">{metric.label}</dt>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}

function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let raf: number;
    const start = performance.now();
    const duration = 1200;

    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(to * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to]);

  return (
    <span ref={ref}>
      {value}
      {suffix}
    </span>
  );
}
