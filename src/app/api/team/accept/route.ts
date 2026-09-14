import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { isMissingSchemaError } from "@/lib/supabase/errors";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspace/active";

/**
 * Accept a workspace invitation.
 *
 * Deliberately not routed through `requireWorkspace()`: a recipient may be a
 * brand-new account whose only workspace is their personal one, and this call is
 * what *grants* the second membership. It needs an authenticated caller, not an
 * existing member.
 *
 * The heavy lifting is in `accept_workspace_invite()`, which checks the token,
 * its expiry, and that the invite's address matches the caller's — all in one
 * transaction, so two people racing on the same link can't both consume it.
 */

const schema = z.object({ token: z.string().min(10) });

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "not-configured" }, { status: 501 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: workspaceId, error } = await supabase.rpc("accept_workspace_invite", {
    p_token: parsed.data.token,
  });

  if (isMissingSchemaError(error)) {
    return NextResponse.json(
      { error: "schema-outdated", message: "This deployment can't accept invitations yet." },
      { status: 501 }
    );
  }
  if (error) {
    // The function's own messages ("sent to a different address", "expired")
    // are user-facing by design, so they pass through rather than being
    // flattened into a generic failure.
    const message = error.message ?? "Could not accept this invitation";
    const kind = /different address/i.test(message)
      ? "email-mismatch"
      : /invalid|expired|not found/i.test(message)
        ? "invite-invalid"
        : "accept-failed";
    return NextResponse.json({ error: kind, message }, { status: 400 });
  }

  // Land them in the workspace they just joined, not the personal one they were
  // looking at when they clicked the link.
  const response = NextResponse.json({ workspaceId });
  if (typeof workspaceId === "string") {
    response.cookies.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
  return response;
}
