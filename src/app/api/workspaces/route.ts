import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireWorkspace } from "@/lib/supabase/auth";
import { isMissingSchemaError } from "@/lib/supabase/errors";
import {
  assertCanCreateWorkspace,
  countOwnedWorkspaces,
  entitlementsFor,
} from "@/lib/saas/entitlements";
import { bestPlan, isPlanId } from "@/lib/saas/plans";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspace/active";

/**
 * Workspaces.
 *
 * GET  — the caller's workspaces plus plan usage, for the switcher and billing.
 * POST — create one, behind the plan's workspace limit.
 *
 * Creation goes through a route rather than a direct client insert so the limit
 * is enforced somewhere the client can't talk its way out of. RLS still decides
 * who may own a workspace; this file only decides how many.
 */

const createSchema = z.object({
  name: z.string().trim().min(1, "Give the workspace a name").max(80),
});

function activeWorkspaceCookie(id: string) {
  return {
    name: ACTIVE_WORKSPACE_COOKIE,
    value: id,
    options: {
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
    },
  };
}

export async function GET() {
  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  const entitlements = entitlementsFor(workspace);

  const { count, error } = await supabase
    .from("workspace_members")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspace.id);
  // No membership table means a pre-tenancy schema, where the only member is you.
  const seatsUsed = isMissingSchemaError(error) ? 1 : Number(count ?? 1);

  return NextResponse.json({
    workspace,
    usage: {
      ownedWorkspaces: await countOwnedWorkspaces(supabase),
      seatsUsed,
    },
    limits: entitlements.limits,
    features: entitlements.features,
    plan: entitlements.plan,
    // Lets the UI say "billing isn't configured" instead of showing a free-tier
    // upgrade prompt to a self-hoster who has no plans to buy.
    billingEnforced: entitlements.enforced,
  });
}

export async function POST(request: NextRequest) {
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid", message: parsed.error.issues[0]?.message ?? "Invalid workspace" },
      { status: 400 }
    );
  }

  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, user } = auth;

  const entitlements = entitlementsFor(auth.workspace);
  const blocked = await assertCanCreateWorkspace(supabase, entitlements);
  if (blocked) return blocked;

  // What plan should the new workspace be on? `plan` defaults to 'free' in the
  // schema, so a Pro account's second workspace would otherwise be a worse
  // product than their first. Read the best plan the account already owns and
  // carry it over.
  const { data: owned } = await supabase
    .from("workspaces")
    .select("plan")
    .eq("owner_id", user.id)
    .is("deleted_at", null);
  const inherited = bestPlan(
    ((owned ?? []) as Array<{ plan?: unknown }>).map((r) => (isPlanId(r.plan) ? r.plan : null))
  );

  const { data, error } = await supabase
    .from("workspaces")
    .insert({
      owner_id: user.id,
      name: parsed.data.name,
      ...(inherited ? { plan: inherited } : {}),
    })
    .select("*")
    .single();
  if (error) {
    if (isMissingSchemaError(error)) {
      return NextResponse.json(
        { error: "schema-outdated", message: "Multiple workspaces need the tenancy migration applied." },
        { status: 501 }
      );
    }
    return NextResponse.json({ error: "create-failed", message: error.message }, { status: 500 });
  }

  // Create-and-enter is the only behaviour that reads as working: staying on the
  // old workspace looks identical to the create having failed.
  const response = NextResponse.json({ workspace: data }, { status: 201 });
  const { name, value, options } = activeWorkspaceCookie((data as { id: string }).id);
  response.cookies.set(name, value, options);
  return response;
}
