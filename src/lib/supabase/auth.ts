// Shared server-side route auth. Every authenticated API route used to copy
// the same ~20-line block: createClient → 501, getUser → 401, workspace
// lookup → 400. This collapses it into one call that returns either a
// resolved { supabase, user, workspace } or the exact error response each
// route used to build itself.
//
// Usage:
//   const auth = await requireWorkspace();
//   if (auth.error) return auth.error;
//   const { supabase, workspace } = auth;
//
// The workspace resolved here is the *active* one, not "the first row I own".
// Call sites only read `workspace.id`, so making the lookup tenancy-aware
// changes behaviour everywhere at once — which is the point, and also why this
// function must never resolve a workspace the caller isn't a member of.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { isMissingSchemaError } from "@/lib/supabase/errors";
import { ACTIVE_WORKSPACE_COOKIE, isWorkspaceId } from "@/lib/workspace/active";
import type { WorkspaceRole } from "@/types/database";

export type Supabase = NonNullable<Awaited<ReturnType<typeof createClient>>>;

/**
 * The workspace a request is acting on.
 *
 * `plan` and `role` are null when the tenancy migration isn't applied. They are
 * optional-typed rather than defaulted to "free"/"owner" precisely so that
 * `getEntitlements()` can tell "this deployment has no billing" apart from
 * "this workspace is on the free tier" — the first enforces nothing.
 */
export interface ActiveWorkspace {
  id: string;
  name: string;
  plan: string | null;
  role: WorkspaceRole | null;
}

export interface WorkspaceSession {
  supabase: Supabase;
  user: { id: string };
  workspace: ActiveWorkspace;
}

export type WorkspaceResult =
  | (WorkspaceSession & { error: null })
  | { error: NextResponse };

type WorkspaceRow = { id: string; name?: string; plan?: unknown; owner_id?: string };

/** Read + normalise the plan column, which may not exist on this deployment. */
function planOf(row: WorkspaceRow | null): string | null {
  return typeof row?.plan === "string" ? row.plan : null;
}

/**
 * Look a workspace up by id. RLS is the authorisation check: a workspace the
 * caller isn't a member of simply isn't returned, so a forged active-workspace
 * cookie resolves to nothing rather than to someone else's data.
 */
async function findWorkspace(supabase: Supabase, id: string): Promise<WorkspaceRow | null> {
  const { data } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return (data as WorkspaceRow | null) ?? null;
}

/** The first workspace the caller belongs to, oldest first. */
async function firstWorkspace(supabase: Supabase): Promise<WorkspaceRow | null> {
  const { data } = await supabase
    .from("workspaces")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as WorkspaceRow | null) ?? null;
}

/**
 * The caller's role, or null when the membership function isn't installed.
 * Before that migration the only possible relationship is ownership, so a null
 * role is treated as owner by callers that need one.
 */
async function roleFor(supabase: Supabase, workspaceId: string): Promise<WorkspaceRole | null> {
  const { data, error } = await supabase.rpc("workspace_member_role", { ws: workspaceId });
  if (isMissingSchemaError(error) || typeof data !== "string") return null;
  return data as WorkspaceRole;
}

/**
 * Resolve the signed-in user's active workspace or return the standard error
 * response. The app works unconfigured, so a missing Supabase setup yields 501 —
 * clients degrade gracefully.
 */
export async function requireWorkspace(): Promise<WorkspaceResult> {
  const supabase = await createClient();
  if (!supabase) {
    return { error: NextResponse.json({ error: "not-configured" }, { status: 501 }) };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }

  // Honour the workspace the UI is showing. A stale or forged cookie (deleted
  // workspace, revoked membership) fails the RLS-scoped lookup below and falls
  // back to the user's own workspace instead of erroring.
  const requested = (await cookies()).get(ACTIVE_WORKSPACE_COOKIE)?.value ?? null;
  let row: WorkspaceRow | null = null;
  if (isWorkspaceId(requested)) {
    row = await findWorkspace(supabase, requested);
  }
  if (!row) {
    row = await firstWorkspace(supabase);
  }
  if (!row) {
    return { error: NextResponse.json({ error: "no-workspace" }, { status: 400 }) };
  }

  return {
    supabase,
    user,
    workspace: {
      id: row.id,
      name: row.name ?? "Workspace",
      plan: planOf(row),
      role: await roleFor(supabase, row.id),
    },
    error: null,
  };
}

/**
 * The caller's workspaces, with their role in each.
 *
 * Reads through membership once applied; before that, RLS narrows `workspaces`
 * to rows they own, which is the correct single-tenant answer.
 */
export async function listWorkspaces(
  supabase: Supabase
): Promise<Array<ActiveWorkspace & { created_at: string }>> {
  const { data, error } = await supabase
    .from("workspaces")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (isMissingSchemaError(error) || !data) return [];

  const rows = data as Array<WorkspaceRow & { created_at: string }>;
  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      name: row.name ?? "Workspace",
      plan: planOf(row),
      role: await roleFor(supabase, row.id),
      created_at: row.created_at,
    }))
  );
}

/**
 * Require that the caller owns the active workspace.
 *
 * Used by anything that changes membership, invitations, the plan, or the
 * workspace itself. Members may edit content; only owners may edit who has
 * access, because a writable membership table is an escalation path.
 */
export async function requireWorkspaceOwner(): Promise<
  | { supabase: Supabase; user: { id: string }; workspace: ActiveWorkspace; error: null }
  | { error: NextResponse }
> {
  const auth = await requireWorkspace();
  if (auth.error) return auth;
  // A null role means the membership layer isn't installed, and the only way to
  // have resolved a workspace then is to own it.
  if (auth.workspace.role !== null && auth.workspace.role !== "owner") {
    return { error: NextResponse.json({ error: "owner-only" }, { status: 403 }) };
  }
  return auth;
}
