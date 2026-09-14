/**
 * Plans & entitlements.
 *
 * Dependency-free on purpose: the same module answers "can this user invite a
 * teammate?" in a React component and in a route handler, and can be unit tested
 * without a database. The *facts* (who is a member, what role, which plan) live
 * in Postgres; the *policy* (what a plan allows) lives here.
 *
 * Two rules are load-bearing and easy to get wrong:
 *
 * 1. An unknown plan resolves to UNLIMITED, not to `free`. The tenancy migration
 *    is what introduces `workspaces.plan`; a deployment that has upgraded the
 *    code but not applied the migration must not have every feature switched
 *    off. `enforced: false` is the "billing isn't configured here" signal.
 *
 * 2. A workspace using its own AI provider key has no AI quota. Assistant calls
 *    are billed to the customer's own provider account, so metering them would
 *    charge the user twice for the same tokens. `aiQuotaApplies()` encodes that
 *    waiver in one place rather than leaving each call site to remember it.
 */

export type PlanId = "free" | "pro" | "team";

/** `null` in a limit means unlimited. */
export interface PlanLimits {
  /** People who can belong to one workspace. */
  seats: number | null;
  /** Workspaces one account can own. */
  workspaces: number | null;
  /**
   * Platform-funded assistant messages per calendar month. Does not apply when
   * the workspace brings its own key — see `aiQuotaApplies()`.
   */
  aiMessagesPerMonth: number | null;
  /** Enabled automation rules per workspace. */
  automationRules: number | null;
}

export interface PlanFeatures {
  /** Invite members, share projects, see the Team settings tab. */
  team: boolean;
  /** Programmatic access with personal tokens. */
  apiAccess: boolean;
  /** Plan badge in the shell, and a support address instead of the repo. */
  prioritySupport: boolean;
  sso: boolean;
}

export interface Entitlements {
  /** The raw plan value as stored. `null` when billing isn't configured. */
  plan: PlanId | null;
  /** False = limits and features are not enforced for this workspace. */
  enforced: boolean;
  limits: PlanLimits;
  features: PlanFeatures;
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  tagline: string;
  /** Display pricing in USD. The single place to change what a plan costs. */
  price: { monthly: number; annual: number };
  priceNote: string;
  limits: PlanLimits;
  features: PlanFeatures;
  /** Bullets on the pricing page, ordered by what sells the tier. */
  highlights: string[];
  bestFor: string;
}

export const PLAN_ORDER: PlanId[] = ["free", "pro", "team"];

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    tagline: "The whole product, for one person.",
    price: { monthly: 0, annual: 0 },
    priceNote: "Forever. No card, no trial countdown.",
    limits: { seats: 1, workspaces: 1, aiMessagesPerMonth: 60, automationRules: 3 },
    features: { team: false, apiAccess: false, prioritySupport: false, sso: false },
    highlights: [
      "Unlimited notes, tasks, projects and daily entries",
      "Semantic search and the knowledge graph",
      "Cited AI assistant and PDF chat",
      "Bring your own AI key for unlimited assistant calls",
      "Voice notes, mind maps, habits and goals",
    ],
    bestFor: "Someone running their own work",
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "For the person with more than one life going on.",
    price: { monthly: 12, annual: 120 },
    priceNote: "Per month, billed annually at 10 months.",
    limits: { seats: 3, workspaces: 5, aiMessagesPerMonth: 1000, automationRules: null },
    features: { team: true, apiAccess: true, prioritySupport: true, sso: false },
    highlights: [
      "Everything in Free",
      "Up to 5 workspaces — work, side projects, client",
      "Invite up to 2 collaborators",
      "1,000 assistant messages a month",
      "Unlimited automation rules",
      "API access and priority support",
    ],
    bestFor: "Freelancers and people with separate contexts",
  },
  team: {
    id: "team",
    name: "Team",
    tagline: "One shared memory for a small team.",
    price: { monthly: 29, annual: 290 },
    priceNote: "Per month for the workspace, includes 5 seats.",
    limits: { seats: 25, workspaces: 25, aiMessagesPerMonth: null, automationRules: null },
    features: { team: true, apiAccess: true, prioritySupport: true, sso: true },
    highlights: [
      "Everything in Pro",
      "25 seats per workspace",
      "Unlimited assistant messages",
      "Shared projects, roles and activity",
      "Single sign-on",
    ],
    bestFor: "Small teams that need the same context",
  },
};

/**
 * What an account gets when the product isn't enforcing billing at all —
 * migration not applied, or a self-hosted instance that never configured it.
 */
const UNENFORCED: Omit<Entitlements, "plan"> = {
  enforced: false,
  limits: { seats: null, workspaces: null, aiMessagesPerMonth: null, automationRules: null },
  features: { team: true, apiAccess: true, prioritySupport: true, sso: true },
};

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && (PLAN_ORDER as string[]).includes(value);
}

/**
 * Resolve what a workspace is entitled to.
 *
 * Accepts anything the database might hand back — a `plan` column, a joined
 * value, or `undefined` because the column doesn't exist yet on this deployment.
 */
export function getEntitlements(plan: string | null | undefined): Entitlements {
  if (!isPlanId(plan)) {
    return { plan: null, ...UNENFORCED };
  }
  const definition = PLANS[plan];
  return {
    plan,
    enforced: true,
    limits: { ...definition.limits },
    features: { ...definition.features },
  };
}

export function planDefinition(plan: PlanId): PlanDefinition {
  return PLANS[plan];
}

/** True when `current` has reached (or passed) a limit. Unlimited never does. */
export function atLimit(current: number, limit: number | null): boolean {
  if (limit === null) return false;
  return current >= limit;
}

/** How many of a limit are left, or `null` when it's unlimited. */
export function remaining(limit: number | null, used: number): number | null {
  if (limit === null) return null;
  return Math.max(limit - used, 0);
}

export function canCreateWorkspace(entitlements: Entitlements, ownedCount: number): boolean {
  return !atLimit(ownedCount, entitlements.limits.workspaces);
}

export function canInviteMembers(entitlements: Entitlements, currentSeats: number): boolean {
  if (!entitlements.features.team) return false;
  return !atLimit(currentSeats, entitlements.limits.seats);
}

export function canUseAutomationRule(
  entitlements: Entitlements,
  enabledRuleCount: number
): boolean {
  return !atLimit(enabledRuleCount, entitlements.limits.automationRules);
}

/**
 * Does the metered AI quota bind this call at all?
 *
 * False when billing isn't enforced, and false when the workspace saved its own
 * provider key — that usage is billed to them directly by their provider, so a
 * platform quota would be double-charging.
 */
export function aiQuotaApplies(entitlements: Entitlements, hasOwnProviderKey: boolean): boolean {
  if (!entitlements.enforced) return false;
  if (hasOwnProviderKey) return false;
  return entitlements.limits.aiMessagesPerMonth !== null;
}

export function withinAiQuota(
  entitlements: Entitlements,
  usedThisMonth: number,
  hasOwnProviderKey: boolean
): boolean {
  if (!aiQuotaApplies(entitlements, hasOwnProviderKey)) return true;
  return usedThisMonth < (entitlements.limits.aiMessagesPerMonth ?? Infinity);
}

/**
 * The highest plan among a set of workspaces.
 *
 * Used when creating a workspace: the `plan` column defaults to 'free', so
 * without this a Pro customer's second workspace would silently be a worse
 * product than their first, and the fix would look like a billing bug. Plans are
 * inherited downward from the best thing an account already has — never upward,
 * so this can't mint a paid tier out of thin air.
 */
export function bestPlan(plans: readonly (string | null | undefined)[]): PlanId | null {
  let best: PlanId | null = null;
  for (const candidate of plans) {
    if (!isPlanId(candidate)) continue;
    if (best === null || PLAN_ORDER.indexOf(candidate) > PLAN_ORDER.indexOf(best)) best = candidate;
  }
  return best;
}

/** The next tier up, or null when already on the top plan. */
export function nextPlan(plan: PlanId | null): PlanId | null {
  const index = plan ? PLAN_ORDER.indexOf(plan) : -1;
  return PLAN_ORDER[index + 1] ?? null;
}

export function isUpgrade(from: PlanId | null, to: PlanId): boolean {
  if (from === null) return true;
  return PLAN_ORDER.indexOf(to) > PLAN_ORDER.indexOf(from);
}

/** Why an action is blocked, shaped for an upgrade prompt. */
export type BlockedReason =
  | { kind: "seats"; limit: number }
  | { kind: "workspaces"; limit: number }
  | { kind: "ai_messages"; limit: number; used: number }
  | { kind: "automation_rules"; limit: number }
  | { kind: "feature"; feature: keyof PlanFeatures };

/**
 * The single question the UI asks before letting a gated action through:
 * what, if anything, does this plan block? `null` means allowed.
 */
export function checkGate(
  entitlements: Entitlements,
  action:
    | { type: "invite_member"; currentSeats: number }
    | { type: "create_workspace"; ownedCount: number }
    | { type: "enable_rule"; enabledCount: number }
    | { type: "ai_message"; usedThisMonth: number; hasOwnProviderKey: boolean }
): BlockedReason | null {
  switch (action.type) {
    case "invite_member": {
      if (!entitlements.features.team) return { kind: "feature", feature: "team" };
      const seats = entitlements.limits.seats;
      return atLimit(action.currentSeats, seats) ? { kind: "seats", limit: seats! } : null;
    }
    case "create_workspace": {
      const workspaces = entitlements.limits.workspaces;
      return atLimit(action.ownedCount, workspaces)
        ? { kind: "workspaces", limit: workspaces! }
        : null;
    }
    case "enable_rule": {
      const rules = entitlements.limits.automationRules;
      return atLimit(action.enabledCount, rules)
        ? { kind: "automation_rules", limit: rules! }
        : null;
    }
    case "ai_message": {
      if (!aiQuotaApplies(entitlements, action.hasOwnProviderKey)) return null;
      const limit = entitlements.limits.aiMessagesPerMonth!;
      return action.usedThisMonth >= limit
        ? { kind: "ai_messages", limit, used: action.usedThisMonth }
        : null;
    }
  }
}

/** Copy for an upgrade prompt, derived from the gate so it can't drift. */
export function blockedMessage(reason: BlockedReason): string {
  switch (reason.kind) {
    case "seats":
      return `This plan includes ${reason.limit} ${reason.limit === 1 ? "seat" : "seats"}. Upgrade to invite more people.`;
    case "workspaces":
      return `This plan includes ${reason.limit} ${reason.limit === 1 ? "workspace" : "workspaces"}. Upgrade to create more.`;
    case "ai_messages":
      return `You've used all ${reason.limit} assistant messages this month. Add your own AI key in Settings to remove this limit, or upgrade.`;
    case "automation_rules":
      return `This plan includes ${reason.limit} automation ${reason.limit === 1 ? "rule" : "rules"}. Upgrade for unlimited.`;
    case "feature":
      return `${featureLabel(reason.feature)} isn't included in this plan.`;
  }
}

export function featureLabel(feature: keyof PlanFeatures): string {
  switch (feature) {
    case "team":
      return "Team collaboration";
    case "apiAccess":
      return "API access";
    case "prioritySupport":
      return "Priority support";
    case "sso":
      return "Single sign-on";
  }
}
