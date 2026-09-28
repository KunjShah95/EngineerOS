import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";

export interface IntegrationSafe {
  id: string;
  workspace_id: string;
  provider: "github";
  username: string | null;
  avatar_url: string | null;
  connected_at: string;
}

export interface GitHubRepo {
  full_name: string;
  html_url: string;
  description: string | null;
  open_issues_count: number;
  private: boolean;
}

export interface GitHubIssue {
  number: number;
  title: string;
  html_url: string;
  body: string | null;
  labels: string[];
}

export async function fetchIntegration(workspaceId: string | null): Promise<IntegrationSafe | null> {
  if (!workspaceId) return null;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("integrations")
    .select("id, workspace_id, provider, username, avatar_url, connected_at")
    .eq("workspace_id", workspaceId)
    .eq("provider", "github")
    .maybeSingle();

  if (error) throw error;
  return data as IntegrationSafe | null;
}

export function useIntegration(workspaceId: string | null) {
  return useQuery({
    queryKey: ["integration", workspaceId ?? ""],
    queryFn: () => fetchIntegration(workspaceId),
    enabled: Boolean(workspaceId),
  });
}

export function useDisconnectIntegration(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/github/disconnect", { method: "POST" });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error ?? "Failed to disconnect");
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["integration", workspaceId ?? ""] });
    },
  });
}

export async function fetchGitHubRepos(): Promise<GitHubRepo[]> {
  const res = await fetch("/api/github/repos");
  if (!res.ok) throw new Error("Failed to load repositories");
  return (await res.json()) as GitHubRepo[];
}

export async function fetchGitHubIssues(repo: string): Promise<GitHubIssue[]> {
  const res = await fetch(`/api/github/issues?repo=${encodeURIComponent(repo)}`);
  if (!res.ok) throw new Error("Failed to load issues");
  return (await res.json()) as GitHubIssue[];
}

/** Repos whose merged PRs are captured as decision notes (lowercased names). */
export function useRepoLinks(workspaceId: string | null) {
  return useQuery({
    queryKey: ["github-repo-links", workspaceId ?? ""],
    queryFn: async (): Promise<string[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("github_repo_links")
        .select("repo_full_name")
        .eq("workspace_id", workspaceId!)
        .eq("capture_prs", true);
      if (error) throw error;
      return ((data ?? []) as { repo_full_name: string }[]).map((r) => r.repo_full_name);
    },
    enabled: Boolean(workspaceId),
  });
}

const REPO_LINK_ERRORS: Record<string, string> = {
  "no-access": "Your GitHub account can't read that repository",
  "not-connected": "Connect GitHub first",
  "not-configured": "PR capture isn't configured on this server",
};

export function useSetRepoCapture(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ repo, enabled }: { repo: string; enabled: boolean }) => {
      const res = enabled
        ? await fetch("/api/github/repo-links", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ repo }),
          })
        : await fetch(`/api/github/repo-links?repo=${encodeURIComponent(repo)}`, { method: "DELETE" });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(REPO_LINK_ERRORS[json?.error ?? ""] ?? json?.error ?? "Couldn't update PR capture");
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["github-repo-links", workspaceId ?? ""] });
    },
  });
}
