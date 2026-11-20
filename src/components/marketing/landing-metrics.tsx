import { Reveal } from "@/components/marketing/reveal";

export interface Stat {
  value: string;
  label: string;
}

/** Real counts from the curriculum, computed on the server. */
export function LandingMetrics({ stats }: { stats: Stat[] }) {
  return (
    <section className="border-y border-border-subtle">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <Reveal>
          <dl className="grid grid-cols-2 lg:grid-cols-4">
            {stats.map((s, i) => (
              <div
                key={s.label}
                className={[
                  "px-4 py-8 sm:py-10",
                  i > 0 ? "lg:border-l lg:border-border-subtle" : "",
                  i === 1 || i === 3 ? "border-l border-border-subtle" : "",
                  i >= 2 ? "border-t border-border-subtle lg:border-t-0" : "",
                ].join(" ")}
              >
                <dd className="font-serif-display text-4xl leading-none tracking-[-0.02em] text-foreground">{s.value}</dd>
                <dt className="label-mono mt-3">{s.label}</dt>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}
