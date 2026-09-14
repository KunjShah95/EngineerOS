"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Mail, Trash2, UserPlus, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UpgradeDialog } from "@/components/saas/UpgradeDialog";
import { useEntitlements, useWorkspace } from "@/hooks/useWorkspace";
import { useInviteMember, useRemoveFromTeam, useTeam } from "@/hooks/useTeam";
import { checkGate } from "@/lib/saas/plans";
import { cn } from "@/lib/utils";

/**
 * Members and invitations.
 *
 * Two ways to add someone, deliberately: send an email, or copy the invite link.
 * The link is not a fallback for missing SMTP — the token *is* the credential
 * (`accept_workspace_invite()` checks the token and the address, never a delivery
 * receipt), so pasting it into a chat is a complete and legitimate way to grant
 * access. That matters most on a self-hosted instance with no Resend key, where
 * an email-only flow would look broken.
 */
export function TeamSection() {
  const { data: workspace } = useWorkspace();
  const entitlements = useEntitlements();
  const { data: team } = useTeam(workspace?.id ?? null);
  const invite = useInviteMember(workspace?.id ?? null);
  const remove = useRemoveFromTeam(workspace?.id ?? null);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const members = team?.members ?? [];
  const invites = team?.invites ?? [];
  const gate = checkGate(entitlements, { type: "invite_member", currentSeats: members.length });

  if (team?.unavailable) {
    return (
      <SectionCard
        title="Team"
        description="Invitations need the tenancy migration (workspace_members). Apply the latest database migration to enable collaborators."
      />
    );
  }

  const submit = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    if (gate) {
      setUpgradeOpen(true);
      return;
    }
    try {
      const body = await invite.mutateAsync({ email: trimmed, role });
      setEmail("");
      toast.success(
        body?.acceptPath
          ? `Invitation created. Copy the link or check email delivery.`
          : "Invitation created."
      );
    } catch (err) {
      const error = err as Error & { upgrade?: boolean };
      if (error.upgrade) setUpgradeOpen(true);
      toast.error(error.message);
    }
  };

  const copyLink = async (path: string) => {
    try {
      const url = new URL(path, window.location.origin).toString();
      await navigator.clipboard.writeText(url);
      toast.success("Invite link copied");
    } catch {
      toast.error("Copy failed — select the link and copy it manually.");
    }
  };

  return (
    <section className="rounded-lg border border-default bg-surface p-5">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <Users className="size-4 text-accent" strokeWidth={1.75} />
        Team
      </h2>
      <p className="mb-4 text-xs text-faint">
        People in this workspace can see and edit its notes, tasks and projects.
      </p>

      {/* Who's here */}
      <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle">
        {members.map((member) => (
          <li key={member.id} className="flex items-center gap-3 bg-base/40 px-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-foreground">
                {member.display_name || member.email || "Member"}
              </span>
              {member.display_name && member.email && (
                <span className="block truncate text-xs text-faint">{member.email}</span>
              )}
            </span>
            <span
              className={cn(
                "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                member.role === "owner"
                  ? "bg-accent-muted text-accent"
                  : "bg-surface-hover text-secondary"
              )}
            >
              {member.role}
            </span>
            {member.role !== "owner" && (
              <button
                type="button"
                aria-label={`Remove ${member.display_name || member.email}`}
                onClick={() =>
                  void remove
                    .mutateAsync({ memberId: member.id })
                    .then(() => toast.success("Removed from workspace"))
                    .catch((err: Error) => toast.error(err.message))
                }
                className="shrink-0 rounded p-1 text-faint transition-colors hover:bg-danger/10 hover:text-danger"
              >
                <Trash2 className="size-3.5" strokeWidth={1.75} />
              </button>
            )}
          </li>
        ))}
        {members.length === 0 && (
          <li className="px-3 py-2.5 text-sm text-faint">Just you so far.</li>
        )}
      </ul>

      {/* Invite */}
      <div className="mt-4 space-y-2">
        <Label htmlFor="invite-email">Invite by email</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="invite-email"
            type="email"
            value={email}
            placeholder="teammate@example.com"
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
          />
          <select
            aria-label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value as "editor" | "viewer")}
            className="rounded-md border border-border-default bg-base px-2 py-2 text-sm text-foreground outline-none focus:border-accent/60"
          >
            <option value="editor">Editor</option>
            <option value="viewer">Viewer (read-only, coming soon)</option>
          </select>
          <Button onClick={() => void submit()} disabled={invite.isPending || !email.trim()}>
            <UserPlus className="size-4" strokeWidth={1.75} />
            {invite.isPending ? "Inviting…" : "Invite"}
          </Button>
        </div>
        <p className="text-xs text-faint">
          Invitations expire after 7 days. You can copy the link instead of
          emailing it — the link is the actual credential.
        </p>
      </div>

      {/* Pending invites, with their copyable links */}
      {invites.length > 0 && (
        <div className="mt-5 border-t border-border-subtle pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-secondary">
            Pending invitations
          </p>
          <ul className="space-y-1.5">
            {invites.map((pendingInvite) => (
              <li
                key={pendingInvite.id}
                className="flex items-center gap-2 rounded-md border border-border-subtle bg-base/40 px-3 py-2"
              >
                <Mail className="size-3.5 shrink-0 text-faint" strokeWidth={1.75} />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {pendingInvite.email}
                </span>
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-faint">
                  {pendingInvite.role}
                </span>
                <button
                  type="button"
                  aria-label={`Copy link for ${pendingInvite.email}`}
                  title="Copy invite link"
                  onClick={() => void copyLink(pendingInvite.acceptPath)}
                  className="shrink-0 rounded p-1 text-faint transition-colors hover:bg-surface-hover hover:text-foreground"
                >
                  <Copy className="size-3.5" strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  aria-label={`Revoke invitation to ${pendingInvite.email}`}
                  onClick={() =>
                    void remove
                      .mutateAsync({ inviteId: pendingInvite.id })
                      .catch((err: Error) => toast.error(err.message))
                  }
                  className="shrink-0 rounded p-1 text-faint transition-colors hover:bg-danger/10 hover:text-danger"
                >
                  <Trash2 className="size-3.5" strokeWidth={1.75} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {gate && (
        <p className="mt-4 flex items-center gap-2 rounded-md border border-accent/30 bg-accent-muted/30 px-3 py-2 text-xs text-secondary">
          <Users className="size-3.5 shrink-0 text-accent" strokeWidth={1.75} />
          {members.length} of {entitlements.limits.seats ?? "∞"} seats used.
          <button
            type="button"
            onClick={() => setUpgradeOpen(true)}
            className="ml-auto font-medium text-accent hover:underline"
          >
            Upgrade
          </button>
        </p>
      )}

      <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} reason={gate} />
    </section>
  );
}

function SectionCard({ title, description }: { title: string; description: string }) {
  return (
    <section className="rounded-lg border border-default bg-surface p-5">
      <h2 className="mb-1 text-sm font-semibold">{title}</h2>
      <p className="text-xs text-faint">{description}</p>
    </section>
  );
}
