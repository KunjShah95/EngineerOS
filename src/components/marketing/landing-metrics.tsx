"use client";

import { Reveal } from "@/components/marketing/reveal";

/** What each object becomes once it's in the system. Not vanity counters. */
const OBJECTS = [
  { name: "Note", becomes: "embedded, linkable, citable" },
  { name: "Task", becomes: "on a board, with a due date" },
  { name: "Project", becomes: "a roof over tasks and notes" },
  { name: "Daily", becomes: "written once, rolled forward" },
];

export function LandingMetrics() {
  return (
    <section className="border-y border-border-subtle">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <Reveal>
          <div className="grid grid-cols-2 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {OBJECTS.map((o) => (
              <div key={o.name} className="px-2 text-center">
                <p className="font-serif-display text-2xl font-normal tracking-tight text-foreground">
                  {o.name}
                </p>
                <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-faint">
                  {o.becomes}
                </p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
