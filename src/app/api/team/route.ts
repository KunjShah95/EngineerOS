import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireWorkspaceOwner } from "@/lib/supabase/auth";
import { isMissingSchemaError } from "@/lib/supabase/errors";
import { assertCanInvite, entitlementsFor } from "@/lib/saas/entitlements";
import { isEmailConfigured, renderInviteEmail, sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/app-url";

/**
 * Team members and invitations.
 *
 *   GET    — who's in the workspace, and which invites are still open.
 *   POST   — invite someone by email.
 *   DELETE — remove a member, or revoke an invite (`{ memberId }` / `{ inviteId }`).
 *
 * Every route here requires an owner, not merely a member: being able to add
 * people is being able to grant access to someone else's work, which is the one
 * authority an editor must not have.
 *
 * Invites work with or without email configured. `accept_workspace_invite()`
 * checks the token, not a delivery receipt, so an owner can paste the link to
 * the person directly. The email is a convenience layered on a mechanism that
 * already stands alone.
 */

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  role: z.enum(["editor", "viewer"]).default("editor"),
});

const removeSchema = z.object({
  memberId: z.string().uuid().optional(),
  inviteId: z.string().uuid().optional(),
});

export async function GET() {
  const auth = await requireWorkspaceOwner();
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  const [membersResult, invitesResult] = await Promise.all([
    supabase
      .from("workspace_members")
      .select("id, user_id, role, joined_at, invited_by, users(email, display_name, avatar_url)")
      .eq("workspace_id", workspace.id)
      .order("joined_at", { ascending: true }),
    supabase
      .from("workspace_invites")
      .select("id, email, role, token, created_at, expires_at")
      .eq("workspace_id", workspace.id)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
  ]);

  if (isMissingSchemaError(membersResult.error)) {
    return NextResponse.json({
      // The UI distinguishes "no team yet" from "team unavailable" so it can
      // offer an upgrade/migrate action rather than an empty list.
      error: "schema-outdated",
      members: [],
      invites: [],
    });
  }

  return NextResponse.json({
    members: (membersResult.data ?? []).map((row) => {
      const profile = (row as Record<string, unknown>).users as
        | { email?: string; display_name?: string; avatar_url?: string | null }
        | { email?: string; display_name?: string; avatar_url?: string | null }[]
        | null;
      const single = Array.isArray(profile) ? profile[0] : profile;
      return {
        id: row.id,
        user_id: row.user_id,
        role: row.role,
        joined_at: row.joined_at,
        email: single?.email ?? null,
        display_name: single?.display_name ?? null,
        avatar_url: single?.avatar_url ?? null,
      };
    }),
    invites: invitesResult.data ?? [],
  });
}

export async function POST(request: NextRequest) {
  const parsed = inviteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid", message: parsed.error.issues[0]?.message ?? "Invalid invitation" },
      { status: 400 }
    );
  }

  const auth = await requireWorkspaceOwner();
  if (auth.error) return auth.error;
  const { supabase, user, workspace } = auth;

  const blocked = await assertCanInvite(supabase, workspace.id, entitlementsFor(workspace));
  if (blocked) return blocked;

  const { data: invite, error } = await supabase
    .from("workspace_invites")
    .upsert(
      {
        workspace_id: workspace.id,
        email: parsed.data.email,
        role: parsed.data.role,
        invited_by: user.id,
        accepted_at: null,
        expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      },
      { onConflict: "workspace_id,email" }
    )
    .select("id, email, role, token, expires_at")
    .single();

  if (isMissingSchemaError(error)) {
    return NextResponse.json(
      { error: "schema-outdated", message: "Applying the tenancy migration enables team invitations." },
      { status: 501 }
    );
  }
  if (error) {
    return NextResponse.json({ error: "invite-failed", message: error.message }, { status: 500 });
  }

  // The token in the URL *is* the credential, so an undelivered email is not a
  // failed invite: the owner can copy this link and send it themselves. `href`
  // is relative for the in-app copy button; the absolute URL is only buildable
  // when a public origin is configured.
  const acceptPath = `/invite/${encodeURIComponent((invite as { token: string }).token)}`;
  const absoluteAcceptUrl = appUrl(acceptPath);
  if (absoluteAcceptUrl && isEmailConfigured()) {
    await sendEmail({
      to: parsed.data.email,
      subject: `You've been invited to ${workspace.name}`,
      html: renderInviteEmail({
        email: parsed.data.email,
        workspaceName: workspace.name,
        acceptUrl: absoluteAcceptUrl,
      }),
    });
  }

  return NextResponse.json({ invite, acceptPath, acceptUrl: absoluteAcceptUrl }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const parsed = removeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const auth = await requireWorkspaceOwner();
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  if (parsed.data.inviteId) {
    const { error } = await supabase
      .from("workspace_invites")
      .delete()
      .eq("id", parsed.data.inviteId)
      .eq("workspace_id", workspace.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.memberId) {
    // Deleting the owner's row would leave a workspace whose membership table
    // disagrees with its `owner_id` — `is_workspace_member()` would still let
    // them in via the owner branch, so the row silently resurrects. Refuse;
    // transferring ownership is a deliberate feature, not a side effect.
    const { data: target } = await supabase
      .from("workspace_members")
      .select("id, role")
      .eq("id", parsed.data.memberId)
      .eq("workspace_id", workspace.id)
      .maybeSingle();
    if (!target) {
      return NextResponse.json({ error: "not-found", message: "That member is not in this workspace." }, { status: 404 });
    }
    if ((target as { role: string }).role === "owner") {
      return NextResponse.json(
        { error: "cannot-remove-owner", message: "The workspace owner can't be removed." },
        { status: 400 }
      );
    }
    const { error } = await supabase
      .from("workspace_members")
      .delete()
      .eq("id", parsed.data.memberId)
      .eq("workspace_id", workspace.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "nothing-to-remove" }, { status: 400 });
}
