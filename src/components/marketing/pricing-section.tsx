"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Check, Minus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PLANS, PLAN_ORDER, type PlanDefinition } from "@/lib/saas/plans";

/**
 * Pricing table.
 *
 * Reads `PLANS` from lib/saas/plans rather than restating the tiers, because a
 * page that lists limits separately from the code enforcing them is a page that
 * eventually lies to someone. Change a plan in one place and both move.
 *
 * Highlights are shown per plan (each tier's own bullets) instead of a
 * feature-by-plan comparison grid: the catalog is the product's description of
 * itself, and forcing it into a boolean matrix would drop the nuance that makes
 * a tier choice obvious.
 */

type Period = "monthly" | "annual";

function priceFor(plan: PlanDefinition, period: Period): string {
  if (plan.price.monthly === 0) return "$0";
  const amount = period === "annual" ? plan.price.annual / 12 : plan.price.monthly;
  return `$${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
}

export function PricingSection({ initial = "monthly" }: { initial?: Period }) {
  const [period, setPeriod] = useState<Period>(initial);

  return (
    <div className="space-y-10">
      <div className="flex justify-center">
        <div
          role="tablist"
          aria-label="Billing period"
          className="inline-flex items-center gap-1 rounded-lg border border-border-subtle bg-surface p-1"
        >
          {(["monthly", "annual"] as const).map((option) => (
            <button
              key={option}
              role="tab"
              type="button"
              aria-selected={period === option}
              onClick={() => setPeriod(option)}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                period === option
                  ? "bg-accent-muted text-foreground"
                  : "text-secondary hover:text-foreground"
              )}
            >
              {option}
              {option === "annual" && (
                <span className="ml-1.5 text-[11px] font-semibold text-accent">save ~17%</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {PLAN_ORDER.map((id, index) => {
          const plan = PLANS[id];
          const featured = id === "pro";
          return (
            <motion.div
              key={id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.05 }}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-surface p-6",
                featured ? "border-accent/40 shadow-elevated" : "border-default"
              )}
            >
              {featured && (
                <span className="absolute -top-2.5 left-6 rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-foreground">
                  Most popular
                </span>
              )}

              <p className="text-sm font-semibold tracking-tight text-foreground">{plan.name}</p>
              <p className="mt-1 text-xs text-secondary">{plan.tagline}</p>

              <p className="mt-5 flex items-baseline gap-1">
                <span className="font-display text-4xl font-semibold tracking-tight text-foreground tabular-nums">
                  {priceFor(plan, period)}
                </span>
                <span className="text-sm text-faint">
                  {plan.price.monthly === 0 ? "forever" : "/mo"}
                </span>
              </p>
              <p className="mt-1 text-xs text-faint">
                {plan.price.monthly === 0
                  ? plan.priceNote
                  : period === "annual"
                    ? `Billed $${plan.price.annual} yearly`
                    : plan.priceNote}
              </p>

              <Button
                asChild
                className="mt-5 w-full"
                variant={featured ? "default" : "secondary"}
              >
                <Link href="/register">{plan.price.monthly === 0 ? "Start free" : `Get ${plan.name}`}</Link>
              </Button>

              <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
                {plan.bestFor}
              </p>
              <ul className="mt-3 space-y-2.5">
                {plan.highlights.map((highlight) => (
                  <li key={highlight} className="flex gap-2.5 text-sm text-secondary">
                    <Check className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={2} />
                    <span className="min-w-0">{highlight}</span>
                  </li>
                ))}
              </ul>

              <dl className="mt-6 space-y-2 border-t border-border-subtle pt-5">
                <LimitRow label="Seats" value={plan.limits.seats} />
                <LimitRow label="Workspaces" value={plan.limits.workspaces} />
                <LimitRow
                  label="Assistant messages / month"
                  value={plan.limits.aiMessagesPerMonth}
                  note="Unlimited with your own AI key on every plan."
                />
              </dl>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function LimitRow({
  label,
  value,
  note,
}: {
  label: string;
  value: number | null;
  note?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-xs text-secondary">
        {label}
        {note && <span className="mt-0.5 block text-[11px] text-faint">{note}</span>}
      </dt>
      <dd className="shrink-0 text-xs font-medium text-foreground tabular-nums">
        {value === null ? (
          <span className="inline-flex items-center gap-1">
            <Minus className="size-3 rotate-45 text-faint" strokeWidth={2} aria-hidden />
            Unlimited
          </span>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
