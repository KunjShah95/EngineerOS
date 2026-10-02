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
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <Reveal>
          {/* A spec strip, not four centered stat cards. Hairline dividers do
              the separating, so there are no boxes at all. */}
          <dl className="grid grid-cols-2 lg:grid-cols-4">
            {OBJECTS.map((o, i) => (
              <div
                key={o.name}
                className={[
                  "px-4 py-8 sm:py-10",
                  i > 0 ? "lg:border-l lg:border-border-subtle" : "",
                  i === 1 ? "border-l border-border-subtle lg:border-l" : "",
                  i === 3 ? "border-l border-border-subtle" : "",
                  i === 2 ? "border-t border-border-subtle lg:border-t-0" : "",
                ].join(" ")}
              >
                <dt className="label-mono">{o.name}</dt>
                <dd className="mt-2 font-serif-display text-xl leading-snug tracking-[-0.01em] text-foreground">
                  {o.becomes}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}
