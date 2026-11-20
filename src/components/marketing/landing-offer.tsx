import Link from "next/link";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/marketing/reveal";
import { PLANS, PLAN_ORDER } from "@/lib/saas/plans";

/**
 * The price list, laid out like a spec sheet. Prices and limits come from
 * lib/saas/plans, the same module that enforces them, so this section cannot
 * promise something the product does not do.
 */
export function LandingOffer() {
  return (
    <section id="plans" className="border-t border-border-subtle py-20 md:py-28">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <Reveal className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
          <div className="max-w-2xl">
            <p className="label-mono">Pricing</p>
            <h2 className="mt-5 font-serif-display text-[clamp(2rem,4.2vw,3.1rem)] font-normal leading-[1.04] tracking-[-0.02em] text-foreground">
              Learning is free.
              <br />
              <em className="font-light italic text-[color:var(--signal)]">Pay when you want a place to keep it.</em>
            </h2>
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-secondary">
            Every lesson, the map and the bot API stay free on every plan. Plans add workspaces, seats and assistant
            capacity.
          </p>
        </Reveal>

        <Reveal delay={0.06} className="mt-12">
          <div className="grid overflow-hidden rounded-lg border border-border-subtle md:grid-cols-3 md:divide-x md:divide-border-subtle max-md:divide-y max-md:divide-border-subtle">
            {PLAN_ORDER.map((id) => {
              const plan = PLANS[id];
              const featured = id === "pro";
              return (
                <div key={id} className={"flex flex-col " + (featured ? "bg-elevated" : "bg-surface")}>
                  <div
                    className={
                      "px-6 py-2 font-mono text-[10px] tracking-[0.14em] uppercase " +
                      (featured
                        ? "bg-foreground text-[color:var(--bg-base)]"
                        : "border-b border-border-subtle text-faint")
                    }
                  >
                    {featured ? "Most chosen" : plan.bestFor}
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <h3 className="font-serif-display text-2xl text-foreground">{plan.name}</h3>
                    <p className="mt-5 flex items-baseline gap-1.5">
                      <span className="font-serif-display text-5xl tracking-[-0.02em] text-foreground tabular-nums">
                        ${plan.price.monthly}
                      </span>
                      <span className="text-sm text-faint">{plan.price.monthly === 0 ? "forever" : "/ month"}</span>
                    </p>
                    <p className="mt-1 min-h-8 text-xs text-faint">
                      {plan.price.annual > 0 ? `or $${plan.price.annual} billed yearly` : plan.priceNote}
                    </p>

                    <ul className="mt-6 flex-1 space-y-2.5">
                      {plan.highlights.slice(0, 5).map((h) => (
                        <li key={h} className="flex gap-2.5 text-sm text-secondary">
                          <Check className="mt-0.5 size-4 shrink-0 text-signal" strokeWidth={2} />
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>

                    <Button asChild className="mt-8 w-full" variant={featured ? "default" : "secondary"}>
                      <Link href="/register">{plan.price.monthly === 0 ? "Start free" : `Get ${plan.name}`}</Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="figure-mono mt-4 text-[11px] text-faint">
            Bring your own AI key and assistant calls are unlimited on every plan.{" "}
            <Link href="/pricing" className="underline underline-offset-4 hover:text-foreground">
              Full comparison
            </Link>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
