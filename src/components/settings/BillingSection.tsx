"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Check, CreditCard, Minus, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/useWorkspace";
import { PLANS, PLAN_ORDER, isPlanId, planDefinition } from "@/lib/saas/plans";
import { cn } from "@/lib/utils";

interface BillingState {
  plan: string | null;
  billingEnforced: boolean;
  limits: { seats: number | null; workspaces: number | null; aiMessagesPerMonth: number | null; automationRules: number | null };
  usage: { ownedWorkspaces: number; seatsUsed: number };
  ai: { used: number; limit: number | null; unlimited: boolean; byok: boolean };
  role: string | null;
}

/**
 * Plan and usage.
 *
 * Shows the meter next to the limit rather than a bare "Pro" badge, because the
 * useful question is "am I about to hit this?" not "what am I called?".
 *
 * When billing isn't enforced (self-hosted, migration not applied) the screen
 * says so plainly instead of rendering a store for a product that has no price.
 */
export function BillingSection() {
  const { data: workspace } = useWorkspace();
  const { data, isLoading } = useQuery({
    queryKey: ["billing", workspace?.id ?? ""],
    queryFn: async (): Promise<BillingState> => {
      const res = await fetch("/api/billing");
      if (!res.ok) throw new Error("Could not load billing");
      return (await res.json()) as BillingState;
    },
    enabled: Boolean(workspace?.id),
    retry: false,
  });

  if (isLoading || !data) {
    return (
      <section className="rounded-lg border border-default bg-surface p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <CreditCard className="size-4 text-accent" strokeWidth={1.75} />
          Plan &amp; usage
        </h2>
        <p className="text-xs text-faint">Loading…</p>
      </section>
    );
  }

  if (!data.billingEnforced) {
    return (
      <section className="rounded-lg border border-default bg-surface p-5">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <CreditCard className="size-4 text-accent" strokeWidth={1.75} />
          Plan &amp; usage
        </h2>
        <p className="text-xs text-secondary">
          This instance runs without plans, so nothing here is limited. Plans and
          seats become available once the tenancy migration is applied and billing
          is configured.
        </p>
      </section>
    );
  }

  const current = isPlanId(data.plan) ? planDefinition(data.plan) : null;

  return (
    <section className="rounded-lg border border-default bg-surface p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <CreditCard className="size-4 text-accent" strokeWidth={1.75} />
          Plan &amp; usage
        </h2>
        <span className="rounded-full bg-accent-muted px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
          {current?.name ?? "Free"}
        </span>
      </div>

      <div className="space-y-3">
        <Meter
          label="Workspaces"
          used={data.usage.ownedWorkspaces}
          limit={data.limits.workspaces}
        />
        <Meter label="Seats in this workspace" used={data.usage.seatsUsed} limit={data.limits.seats} />
        {data.ai.unlimited ? (
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-secondary">
              Assistant messages
              {data.ai.byok && (
                <span className="mt-0.5 block text-xs text-faint">
                  Using your own AI key — no platform limit.
                </span>
              )}
            </span>
            <span className="shrink-0 rounded bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
              Unlimited
            </span>
          </div>
        ) : (
          <Meter
            label="Assistant messages this month"
            used={data.ai.used}
            limit={data.ai.limit}
          />
        )}
      </div>

      <p className="mt-4 text-xs text-faint">
        Bring your own AI provider key in Settings → AI Provider and the assistant
        allowance no longer applies — that usage is billed to you directly.
      </p>

      <div className="mt-5 border-t border-border-subtle pt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-secondary">
          Compare plans
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {PLAN_ORDER.map((id) => {
            const plan = PLANS[id];
            const isCurrent = data.plan === id;
            return (
              <div
                key={id}
                className={cn(
                  "rounded-lg border p-3",
                  isCurrent ? "border-accent/40 bg-accent-muted/20" : "border-border-subtle"
                )}
              >
                <p className="text-xs font-semibold text-foreground">{plan.name}</p>
                <p className="mt-0.5 text-[11px] text-faint tabular-nums">
                  {plan.price.monthly === 0 ? "Free" : `$${plan.price.monthly}/mo`}
                </p>
                <p className="mt-1.5 flex items-center gap-1 text-[11px] text-secondary">
                  {plan.features.team ? (
                    <Check className="size-3 text-accent" strokeWidth={2} />
                  ) : (
                    <Minus className="size-3 text-faint" strokeWidth={2} />
                  )}
                  Team collaboration
                </p>
              </div>
            );
          })}
        </div>
        <Button asChild variant="secondary" size="sm" className="mt-3 w-full">
          <Link href="/pricing">
            <Sparkles className="size-3.5" strokeWidth={1.75} />
            See full pricing
          </Link>
        </Button>
      </div>
    </section>
  );
}

function Meter({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const pct = limit === null ? 0 : Math.min(Math.round((used / limit) * 100), 100);
  const near = limit !== null && used >= limit;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
        <span className="text-secondary">{label}</span>
        <span className="shrink-0 text-xs text-faint tabular-nums">
          {used}
          {limit === null ? "" : ` / ${limit}`}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-hover">
        <div
          className={cn("h-full rounded-full transition-all duration-300", near ? "bg-warning" : "bg-accent")}
          style={{ width: `${limit === null ? 0 : pct}%` }}
        />
      </div>
    </div>
  );
}
