import { NextResponse } from "next/server";

import { requireWorkspace } from "@/lib/supabase/auth";
import {
  countOwnedWorkspaces,
  countSeats,
  entitlementsFor,
  readAiQuota,
} from "@/lib/saas/entitlements";

/**
 * Plan + usage for the active workspace, in one round trip.
 *
 * The billing screen needs four numbers (plan, workspaces owned, seats taken,
 * assistant messages used) that come from three different places: a column, a
 * membership count, and a Postgres meter function. Assembling them server-side
 * keeps the client from firing four queries and, more importantly, keeps the
 * numbers authoritative — they're read from the database, not reported by the
 * browser that wants them to be lower.
 */
export async function GET() {
  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  const entitlements = entitlementsFor(workspace);
  const [ownedWorkspaces, seatsUsed, ai] = await Promise.all([
    countOwnedWorkspaces(supabase),
    countSeats(supabase, workspace.id),
    readAiQuota(supabase, workspace, entitlements),
  ]);

  return NextResponse.json({
    plan: entitlements.plan,
    billingEnforced: entitlements.enforced,
    limits: entitlements.limits,
    features: entitlements.features,
    usage: { ownedWorkspaces, seatsUsed },
    ai,
    role: workspace.role,
  });
}
