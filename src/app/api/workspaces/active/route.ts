import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { isMissingSchemaError } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspace/active";

/**
 * Switch the active workspace.
 *
 * The client flips optimistically before calling this, so the route's job is not
 * to *make* the switch but to *authorise* it: it rewrites the cookie with a
 * server-set value and fails if the caller isn't a member. Without that check a
 * hand-edited cookie would leave the browser pointed at a workspace the API
 * disagrees with, and the resulting blank screens read as data loss.
 */

const schema = z.object({ id: z.string().uuid() });

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "not-configured" }, { status: 501 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // RLS *is* the membership check here: a workspace the caller doesn't belong to
  // is not returned, so no separate role query is needed (or trusted).
  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select("id, name")
    .eq("id", parsed.data.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (isMissingSchemaError(error)) {
    return NextResponse.json({ error: "schema-outdated", message: "Multi-workspace needs the tenancy migration." }, { status: 501 });
  }
  if (!workspace) {
    return NextResponse.json({ error: "not-a-member" }, { status: 403 });
  }

  const response = NextResponse.json({ workspace });
  response.cookies.set(ACTIVE_WORKSPACE_COOKIE, parsed.data.id, {
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
