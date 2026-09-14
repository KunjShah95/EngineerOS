/**
 * Server-side entitlement checks.
 *
 * `src/lib/saas/plans.ts` is pure policy; this file is the part that has to read
 * the database in order to answer it. Two rules it must not break:
 *
 *   - Never fail hard when the tenancy migration isn't applied. A deployment
 *     that upgrades code but not schema keeps running with limits unenforced —
 *     the same contract `loadAiConfig()` gives a missing `ai_configs` table.
 *   - Never trust a client-supplied plan. The plan is read from the row RLS
 *     handed back, so a tampered request can only ever describe a workspace the
 *     caller already has access to.
 */

import { NextResponse } from "next/server";

import { loadAiConfig } from "@/lib/ai/db-config";
import { isMissingSchemaError } from "@/lib/supabase/errors";
import type { Supabase } from "@/lib/supabase/auth";
import {
  blockedMessage,
  checkGate,
  getEntitlements,
  nextPlan,
  type BlockedReason,
  type Entitlements,
} from "@/lib/saas/plans";
import type { ActiveWorkspace } from "@/lib/supabase/auth";

export { isMissingSchemaError };

/** Entitlements for a workspace row, tolerant of a missing `plan` column. */
export function entitlementsFor(workspace: Pick<ActiveWorkspace, "plan"> | null | undefined): Entitlements {
  return getEntitlements(workspace?.plan ?? null);
}

/**
 * Does this workspace pay for its own AI?
 *
 * When an owner has saved a provider key, assistant calls are billed to their
 * account, so a platform meter would charge them twice for the same tokens.
 * Absent config we assume platform-funded and apply the limit: the conservative
 * direction for revenue, and a no-op for a self-hoster (unenforced anyway).
 */
export async function hasOwnProviderKey(supabase: Supabase, workspaceId: string): Promise<boolean> {
  const config = await loadAiConfig(supabase, workspaceId);
  return Boolean(config?.apiKey);
}

/** Assistant messages used this calendar month. 0 when the meter isn't installed. */
export async function aiUsageThisMonth(supabase: Supabase, workspaceId: string): Promise<number> {
  const { data, error } = await supabase.rpc("ai_usage_this_month", { p_workspace: workspaceId });
  if (isMissingSchemaError(error)) return 0;
  return Number(data ?? 0);
}

/** Workspaces this account owns. 0 when the helper isn't installed. */
export async function countOwnedWorkspaces(supabase: Supabase): Promise<number> {
  const { data, error } = await supabase.rpc("count_owned_workspaces");
  if (isMissingSchemaError(error)) return 0;
  return Number(data ?? 0);
}

/** Seats taken in a workspace. 0 when the membership table isn't installed. */
export async function countSeats(supabase: Supabase, workspaceId: string): Promise<number> {
  const { count, error } = await supabase
    .from("workspace_members")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);
  if (isMissingSchemaError(error)) return 0;
  return Number(count ?? 0);
}

/**
 * The wire contract for a plan-blocked action.
 *
 * 402 is semantically correct and lets the client branch on
 * `error === "upgrade_required"` instead of pattern-matching prose. `upgradeTo`
 * is null on the top plan so the UI can render a status line rather than a dead
 * "Upgrade" button.
 */
export function upgradeRequiredResponse(reason: BlockedReason, entitlements: Entitlements): NextResponse {
  return NextResponse.json(
    {
      error: "upgrade_required",
      kind: reason.kind,
      message: blockedMessage(reason),
      plan: entitlements.plan,
      upgradeTo: nextPlan(entitlements.plan),
      pricingHref: "/pricing",
    },
    { status: 402 }
  );
}

/** True when a route response is an upgrade gate, for client-side handling. */
export async function readUpgradeGate(response: Response): Promise<{ message: string; upgradeTo: string | null } | null> {
  if (response.status !== 402) return null;
  try {
    const body = (await response.clone().json()) as {
      error?: string;
      message?: string;
      upgradeTo?: string | null;
    };
    if (body?.error !== "upgrade_required") return null;
    return { message: body.message ?? "Upgrade your plan to continue.", upgradeTo: body.upgradeTo ?? null };
  } catch {
    return null;
  }
}

/** Guard for creating another workspace. Null means "proceed". */
export async function assertCanCreateWorkspace(
  supabase: Supabase,
  entitlements: Entitlements
): Promise<NextResponse | null> {
  const owned = await countOwnedWorkspaces(supabase);
  const gate = checkGate(entitlements, { type: "create_workspace", ownedCount: owned });
  return gate ? upgradeRequiredResponse(gate, entitlements) : null;
}

/** Guard for adding a collaborator (covers invites and direct membership). */
export async function assertCanInvite(
  supabase: Supabase,
  workspaceId: string,
  entitlements: Entitlements
): Promise<NextResponse | null> {
  const seats = await countSeats(supabase, workspaceId);
  const gate = checkGate(entitlements, { type: "invite_member", currentSeats: seats });
  return gate ? upgradeRequiredResponse(gate, entitlements) : null;
}

/**
 * Guard for a metered assistant call. Returns null when the call may proceed.
 * Runs after auth and before any provider request, so a blocked call never burns
 * upstream tokens.
 */
export async function assertAiQuota(
  supabase: Supabase,
  workspace: Pick<ActiveWorkspace, "id" | "plan">,
  entitlements: Entitlements
): Promise<NextResponse | null> {
  const ownKey = await hasOwnProviderKey(supabase, workspace.id);
  const gate = checkGate(entitlements, {
    type: "ai_message",
    usedThisMonth: await aiUsageThisMonth(supabase, workspace.id),
    hasOwnProviderKey: ownKey,
  });
  return gate ? upgradeRequiredResponse(gate, entitlements) : null;
}

export interface AiQuotaState {
  used: number;
  /** Null = unlimited. */
  limit: number | null;
  unlimited: boolean;
  byok: boolean;
}

/** Quota state for the settings page and inline meters. */
export async function readAiQuota(
  supabase: Supabase,
  workspace: Pick<ActiveWorkspace, "id">,
  entitlements: Entitlements
): Promise<AiQuotaState> {
  const byok = await hasOwnProviderKey(supabase, workspace.id);
  const limit = entitlements.limits.aiMessagesPerMonth;
  if (byok || !entitlements.enforced || limit === null) {
    return { used: 0, limit: null, unlimited: true, byok };
  }
  return { used: await aiUsageThisMonth(supabase, workspace.id), limit, unlimited: false, byok };
}
