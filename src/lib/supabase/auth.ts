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

import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export type Supabase = NonNullable<Awaited<ReturnType<typeof createClient>>>;

export interface WorkspaceSession {
  supabase: Supabase;
  user: { id: string };
  workspace: { id: string };
}

export type WorkspaceResult =
  | (WorkspaceSession & { error: null })
  | { error: NextResponse };

/**
 * Resolve the signed-in user's active workspace (single-owner model) or
 * return the standard error response. The app works unconfigured, so a
 * missing Supabase setup yields 501 — clients degrade gracefully.
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

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (!workspace) {
    return { error: NextResponse.json({ error: "no-workspace" }, { status: 400 }) };
  }

  return { supabase, user, workspace, error: null };
}
