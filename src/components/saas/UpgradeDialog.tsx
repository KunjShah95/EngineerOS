"use client";

import Link from "next/link";
import { Check, Sparkles } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useEntitlements } from "@/hooks/useWorkspace";
import { PLANS, PLAN_ORDER, featureLabel, type BlockedReason } from "@/lib/saas/plans";
import { cn } from "@/lib/utils";

/**
 * The upgrade conversation, in one place.
 *
 * Every gated surface (invite, new workspace, quota-exhausted assistant call)
 * would otherwise invent its own paywall copy and drift out of sync with the
 * pricing page. This renders the same catalog `PLANS` that drives the actual
 * limits, so the promise and the enforcement can't disagree.
 *
 * When billing isn't enforced on this deployment the dialog says so instead of
 * selling a plan nobody can buy — the right behaviour for a self-hosted install
 * that stumbled onto a limit because its schema is out of date.
 */
export function UpgradeDialog({
  open,
  onOpenChange,
  reason,
  title,
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What the user tried to do, used to explain the block concretely. */
  reason?: BlockedReason | null;
  title?: string;
  description?: string;
}) {
  const entitlements = useEntitlements();

  const heading =
    title ??
    (reason ? "This needs a different plan" : "Choose a plan");
  const body =
    description ??
    (reason
      ? REASON_COPY[reason.kind]
      : "Plans are per workspace. Everything you have now keeps working.");

  if (!entitlements.enforced) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Billing isn&apos;t configured</DialogTitle>
            <DialogDescription>
              This instance runs without plans, so no limit applies to it. If
              you&apos;re seeing this after hitting a wall, the database schema is
              probably behind the code — apply the latest migration.
            </DialogDescription>
          </DialogHeader>
          <Button variant="secondary" className="w-full" asChild>
            <Link href="/settings">Go to settings</Link>
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-accent" strokeWidth={1.75} />
            {heading}
          </DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          {PLAN_ORDER.map((id) => {
            const plan = PLANS[id];
            const isCurrent = entitlements.plan === id;
            return (
              <div
                key={id}
                className={cn(
                  "rounded-lg border p-4",
                  isCurrent ? "border-accent/40 bg-accent-muted/30" : "border-default bg-surface"
                )}
              >
                <p className="text-sm font-semibold">{plan.name}</p>
                <p className="mt-0.5 text-xs text-faint">
                  {plan.price.monthly === 0
                    ? "Free"
                    : `$${plan.price.monthly}/mo`}
                </p>
                <p className="mt-2 line-clamp-2 text-xs text-secondary">{plan.tagline}</p>
                <ul className="mt-3 space-y-1.5">
                  {plan.highlights.slice(0, 3).map((h) => (
                    <li key={h} className="flex gap-1.5 text-xs text-secondary">
                      <Check className="mt-0.5 size-3 shrink-0 text-accent" strokeWidth={2} />
                      <span className="min-w-0">{h}</span>
                    </li>
                  ))}
                </ul>
                {isCurrent && (
                  <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-accent">
                    Current plan
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {reason?.kind === "ai_messages" && (
          <p className="rounded-md border border-border-subtle bg-surface-hover/50 px-3 py-2 text-xs text-secondary">
            Faster than upgrading: save your own AI key in{" "}
            <Link href="/settings" className="font-medium text-accent hover:underline">
              Settings → AI Provider
            </Link>{" "}
            and the assistant limit disappears — that usage is billed to you
            directly, not to us.
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild className="flex-1">
            <Link href="/pricing">Compare plans</Link>
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Per-block headlines.
 *
 * "You need Pro" is a worse prompt than "this workspace is full" — naming the
 * actual constraint is what makes an upgrade feel fair rather than extractive.
 */
const REASON_COPY: Record<BlockedReason["kind"], string> = {
  workspaces: "You've reached the number of workspaces your plan includes. Separate contexts — work, personal, a client — each get their own.",
  seats: "Your plan's seats are full. Upgrade to bring more people into this workspace.",
  ai_messages: "You've used this month's assistant messages. Add your own AI key to keep going, or upgrade for a higher allowance.",
  automation_rules: "Your plan caps how many automation rules run at once.",
  feature: `${featureLabel("team")} isn't part of your current plan.`,
};
