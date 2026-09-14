import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isMissingSchemaError } from "@/lib/supabase/errors";
import { resolveActiveWorkspaceId } from "@/lib/workspace/active";
import { getEntitlements, type Entitlements } from "@/lib/saas/plans";
import { useUiStore } from "@/lib/store/ui";
import type { Workspace, WorkspaceRole, WorkspaceWithRole } from "@/types/database";

export const workspaceQueryKey = ["workspace"] as const;
/**
 * The list query is a *child* of `workspaceQueryKey` rather than a new name.
 *
 * Settings code (written before multi-workspace existed) invalidates
 * `["workspace"]` after a rename. TanStack Query matches keys by array prefix, so
 * `["workspace", "list"]` is caught by that invalidation while still being
 * distinct from any single-workspace read. Naming this `["workspaces"]` would
 * have silently stopped the sidebar from refreshing after a workspace rename.
 */
export const workspacesQueryKey = [...workspaceQueryKey, "list"] as const;

/** Raw membership row embedded alongside a workspace. */
type WorkspaceRow = Workspace & {
  workspace_members?: Array<{ role: WorkspaceRole; user_id: string }> | null;
};

/**
 * Every workspace the signed-in user belongs to, with their role in each.
 *
 * The embed on `workspace_members` is what turns this from "workspaces I own"
 * into "workspaces I'm a member of". On a deployment where the tenancy migration
 * hasn't been applied, that embed names a table that doesn't exist — so we retry
 * without it and report owner-only membership, which is exactly what a
 * pre-tenancy database can contain. The alternative (hard failure) would take the
 * whole app down for anyone who upgrades code before schema.
 */
async function fetchWorkspaces(): Promise<WorkspaceWithRole[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("workspaces")
    // `user_id` is selected because the embed returns every member of the
    // workspace; the row that is *us* is the one carrying our role.
    .select("*, workspace_members(role, user_id)")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (isMissingSchemaError(error)) {
    const fallback = await supabase
      .from("workspaces")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    if (fallback.error) throw fallback.error;
    return ((fallback.data ?? []) as Workspace[]).map((w) => ({
      ...w,
      // Pre-tenancy, RLS only ever returns workspaces you own.
      role: (w.owner_id === user?.id ? "owner" : null) as WorkspaceRole | null,
    }));
  }

  if (error) throw error;

  return ((data ?? []) as WorkspaceRow[]).map((row) => {
    const mine = (row.workspace_members ?? []).find((m) => m.user_id === user?.id);
    const { workspace_members: _embedded, ...workspace } = row;
    return {
      ...workspace,
      role: mine?.role ?? (row.owner_id === user?.id ? "owner" : null),
    };
  });
}

/**
 * All of the user's workspaces plus the one they're currently looking at.
 *
 * The active id lives in the UI store (backed by a cookie, which is what the API
 * routes read). Resolving it against the loaded list means a stale cookie — a
 * deleted workspace, a revoked invitation, a cookie from a different account —
 * falls back to a workspace the user can actually open instead of blanking the
 * screen.
 */
export function useWorkspaces() {
  const query = useQuery({
    queryKey: workspacesQueryKey,
    queryFn: fetchWorkspaces,
    enabled: isSupabaseConfigured(),
    retry: false,
    staleTime: 30_000,
  });

  const storedId = useUiStore((s) => s.activeWorkspaceId);
  const setActiveWorkspace = useUiStore((s) => s.setActiveWorkspaceId);

  const workspaces = query.data ?? [];
  const activeWorkspaceId = resolveActiveWorkspaceId(
    storedId,
    workspaces.map((w) => w.id)
  );
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;

  // Realign the store (and therefore the cookie) when the stored id turns out to
  // be stale, so the next page load and every API call agree with what we show.
  useEffect(() => {
    if (activeWorkspaceId && activeWorkspaceId !== storedId) setActiveWorkspace(activeWorkspaceId);
  }, [activeWorkspaceId, storedId, setActiveWorkspace]);

  return {
    ...query,
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    setActiveWorkspace,
    /** `plan: null` — billing isn't configured on this deployment: no limits. */
    entitlements: getEntitlements(activeWorkspace?.plan ?? null),
    /** Null role means the membership layer isn't installed, so they own it. */
    isOwner: activeWorkspace ? activeWorkspace.role === null || activeWorkspace.role === "owner" : false,
  };
}

/**
 * The active workspace, in the shape the app has always asked for.
 *
 * This is the seam that made multi-workspace a drop-in change: ~26 call sites
 * read `{ data: workspace }` and now transparently receive whichever workspace
 * the user selected, the same one the API routes resolve from the cookie.
 */
export function useWorkspace() {
  const { workspaces, activeWorkspace, ...rest } = useWorkspaces();
  return {
    ...rest,
    data: activeWorkspace,
    allWorkspaces: workspaces,
  };
}

/** Entitlements for the active workspace, derived from its stored plan. */
export function useEntitlements(): Entitlements {
  const { data: workspace } = useWorkspace();
  return getEntitlements(workspace?.plan ?? null);
}

/** Raised when the API refused an action because of the plan. */
export class UpgradeRequiredError extends Error {
  readonly upgradeTo: string | null;
  constructor(message: string, upgradeTo: string | null) {
    super(message);
    this.name = "UpgradeRequiredError";
    this.upgradeTo = upgradeTo;
  }
}

/** Turn a route response into an error, surfacing the 402 upgrade contract. */
async function readApiError(res: Response, fallback: string): Promise<Error> {
  const body = (await res.json().catch(() => null)) as {
    error?: string;
    message?: string;
    upgradeTo?: string | null;
  } | null;
  if (body?.error === "upgrade_required") {
    return new UpgradeRequiredError(body.message ?? "Upgrade your plan to continue.", body.upgradeTo ?? null);
  }
  return new Error(body?.message ?? body?.error ?? fallback);
}

/** Create a workspace through the API, where the plan limit is enforced. */
export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  const setActiveWorkspace = useUiStore((s) => s.setActiveWorkspaceId);
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw await readApiError(res, "Could not create workspace");
      const body = (await res.json()) as { workspace: Workspace };
      return body.workspace;
    },
    onSuccess: (workspace) => {
      // A new workspace you can't see is a new workspace you think failed.
      setActiveWorkspace(workspace.id);
      queryClient.invalidateQueries({ queryKey: workspacesQueryKey });
    },
  });
}

/** Point the app at another workspace: store + cookie, then refetch everything. */
export function useSwitchWorkspace() {
  const queryClient = useQueryClient();
  const setActiveWorkspace = useUiStore((s) => s.setActiveWorkspaceId);
  return useMutation({
    mutationFn: async (id: string) => {
      setActiveWorkspace(id);
      const res = await fetch("/api/workspaces/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      // The client already switched optimistically; a refusal here means the
      // server rejected membership, so revert by refetching the truth.
      if (!res.ok) throw await readApiError(res, "Could not switch workspace");
      return id;
    },
    onSuccess: () => {
      // Every cached read is workspace-scoped. Dropping the cache wholesale is
      // cheaper than reasoning about which keys moved, and it is the usual cause
      // of seeing one workspace's data under another workspace's name.
      queryClient.invalidateQueries();
    },
  });
}

/** Update the active workspace's name or onboarding marker. */
export function useUpdateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: { name?: string; onboarded_at?: string | null };
    }) => {
      const supabase = createClient();
      const { error } = await supabase.from("workspaces").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspacesQueryKey });
    },
  });
}

/**
 * Record that the first-run checklist was completed or dismissed.
 *
 * `onboarded_at` only exists after the tenancy migration, so an error is
 * swallowed rather than surfaced: a self-hoster on the old schema would otherwise
 * see a red toast for declining a tour, and the worst outcome is that the
 * checklist keeps showing.
 */
export function useDismissOnboarding() {
  const { data: workspace } = useWorkspace();
  const update = useUpdateWorkspace();
  return () =>
    new Promise<void>((resolve) => {
      if (!workspace) return resolve();
      update.mutate(
        { id: workspace.id, patch: { onboarded_at: new Date().toISOString() } },
        { onSuccess: () => resolve(), onError: () => resolve() }
      );
    });
}
