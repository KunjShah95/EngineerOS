"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { WorkspaceInvite, WorkspaceMember } from "@/types/database";

/**
 * Members and invitations for the active workspace.
 *
 * Reads and writes go through /api/team rather than Supabase directly. Two
 * reasons: the response shape joins `users` onto membership (which the client
 * would need a second round trip for), and the plan's seat limit has to be
 * checked by someone the client can't argue with.
 *
 * A `schema-outdated` response is surfaced as `unavailable` instead of throwing,
 * so the settings page can render "apply the tenancy migration to enable teams"
 * rather than a red error for a self-hosted install that simply hasn't migrated.
 */

export interface TeamState {
  members: WorkspaceMember[];
  invites: Array<WorkspaceInvite & { acceptPath: string }>;
  /** True when the membership tables aren't installed on this deployment. */
  unavailable: boolean;
}

export const teamQueryKey = (workspaceId: string | null) => ["team", workspaceId ?? ""] as const;

async function readTeam(response: Response): Promise<TeamState> {
  const body = (await response.json().catch(() => null)) as {
    error?: string;
    message?: string;
    members?: WorkspaceMember[];
    invites?: Array<WorkspaceInvite & { acceptPath?: string }>;
  } | null;
  if (response.status === 402) {
    // An upgrade refusal on a *read* means the plan has no team feature. Treat it
    // as empty-but-usable so the section can show the upgrade card inline.
    return { members: [], invites: [], unavailable: false };
  }
  if (!response.ok) {
    throw new Error(body?.message ?? "Could not load your team");
  }
  if (body?.error === "schema-outdated") {
    return { members: [], invites: [], unavailable: true };
  }
  return {
    members: body?.members ?? [],
    invites: (body?.invites ?? []).map((invite) => ({
      ...invite,
      acceptPath: `/invite/${invite.token}`,
    })),
    unavailable: false,
  };
}

export function useTeam(workspaceId: string | null) {
  return useQuery({
    queryKey: teamQueryKey(workspaceId),
    queryFn: async () => {
      const res = await fetch("/api/team");
      return readTeam(res);
    },
    enabled: Boolean(workspaceId),
    retry: false,
  });
}

/** True when a mutation failure was a plan limit rather than a real error. */
function isUpgrade(res: Response): boolean {
  return res.status === 402;
}

export function useInviteMember(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; role?: "editor" | "viewer" }) => {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = (await res.json().catch(() => null)) as {
        message?: string;
        error?: string;
        invite?: WorkspaceInvite;
        acceptPath?: string | null;
        acceptUrl?: string | null;
      } | null;
      if (!res.ok) {
        const error = new Error(body?.message ?? "Could not send the invitation");
        (error as Error & { upgrade?: boolean; acceptPath?: string | null }).upgrade = isUpgrade(res);
        (error as Error & { acceptPath?: string | null }).acceptPath = body?.acceptPath ?? null;
        throw error;
      }
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamQueryKey(workspaceId) });
    },
  });
}

export function useRemoveFromTeam(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (target: { memberId?: string; inviteId?: string }) => {
      const res = await fetch("/api/team", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(target),
      });
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      if (!res.ok) throw new Error(body?.message ?? "Could not remove them");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamQueryKey(workspaceId) });
    },
  });
}

/**
 * Role changes are deliberately absent: `viewer` is stored by the schema but no
 * read-only policy sweep exists yet (roadmap S4), so a role picker would be a
 * control that promises enforcement it can't deliver. Members see their role;
 * only invitations assign one.
 */
