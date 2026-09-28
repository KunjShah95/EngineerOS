// Server-only GitHub helpers (OAuth exchange + REST API calls).
// Tokens always live server-side; API routes read them from the DB.

const GITHUB_AUTH = "https://github.com/login/oauth";
const GITHUB_API = "https://api.github.com";

function githubHeaders(token: string, extra: Record<string, string> = {}) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "EngineerOS",
    ...extra,
  };
}

/** URL users are sent to. `state` prevents CSRF on the callback. */
export function githubAuthorizeUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    scope: "repo read:user",
    state,
  });
  return `${GITHUB_AUTH}/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<{ access_token: string; scope: string }> {
  const res = await fetch(`${GITHUB_AUTH}/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  });
  const json = (await res.json()) as { access_token?: string; scope?: string; error?: string };
  if (!json.access_token) {
    throw new Error(json.error ?? "GitHub token exchange failed");
  }
  return { access_token: json.access_token, scope: json.scope ?? "" };
}

export interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
  name: string | null;
}

export async function fetchGitHubUser(token: string): Promise<GitHubUser> {
  const res = await fetch(`${GITHUB_API}/user`, { headers: githubHeaders(token) });
  if (!res.ok) throw new Error(`GitHub user fetch failed (${res.status})`);
  return (await res.json()) as GitHubUser;
}

export interface GitHubRepo {
  id: number;
  full_name: string;
  html_url: string;
  description: string | null;
  open_issues_count: number;
  private: boolean;
}

export async function fetchGitHubRepos(token: string): Promise<GitHubRepo[]> {
  const res = await fetch(
    `${GITHUB_API}/user/repos?per_page=100&sort=updated&type=owner`,
    { headers: githubHeaders(token) }
  );
  if (!res.ok) throw new Error(`GitHub repos fetch failed (${res.status})`);
  return (await res.json()) as GitHubRepo[];
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  html_url: string;
  body: string | null;
  state: "open" | "closed";
  labels: { name: string }[];
}

export async function fetchGitHubIssues(token: string, repo: string): Promise<GitHubIssue[]> {
  const res = await fetch(
    `${GITHUB_API}/repos/${encodeURIComponent(repo)}/issues?state=open&per_page=50&sort=created&direction=desc`,
    { headers: githubHeaders(token) }
  );
  if (!res.ok) throw new Error(`GitHub issues fetch failed (${res.status})`);
  const issues = (await res.json()) as GitHubIssue[];
  // The issues endpoint includes PRs; filter them out.
  return issues.filter((i) => !("pull_request" in i));
}

/** "owner/repo" as GitHub allows it; rejects paths, queries and whitespace. */
export const REPO_FULL_NAME = /^[\w.-]+\/[\w.-]+$/;

/**
 * Whether `token` can read `repo`, returning GitHub's canonical full_name
 * (null on 403/404). Gatekeeps repo links: the webhook writes a linked repo's
 * PR descriptions into the workspace, so a link must prove access first.
 */
export async function readableRepoName(token: string, repo: string): Promise<string | null> {
  if (!REPO_FULL_NAME.test(repo)) return null;
  const res = await fetch(`${GITHUB_API}/repos/${repo}`, { headers: githubHeaders(token) });
  if (res.status === 403 || res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub repo fetch failed (${res.status})`);
  return ((await res.json()) as { full_name: string }).full_name;
}

/** Events the EngineerOS webhook route handles. */
export const WEBHOOK_EVENTS = ["issues", "pull_request"];

export type EnsureWebhookResult =
  | { status: "created"; id: number }
  | { status: "exists" }
  | { status: "no-permission" };

/**
 * Make sure `repo` has a webhook pointing at `url`. Creating hooks needs admin
 * on the repo; collaborators without it get "no-permission" and must ask an
 * admin (or add it by hand). An existing hook for the same URL — created by
 * another workspace or manually — is left untouched.
 */
export async function ensureRepoWebhook(
  token: string,
  repo: string,
  url: string,
  secret: string,
): Promise<EnsureWebhookResult> {
  if (!REPO_FULL_NAME.test(repo)) throw new Error("invalid repo");

  const list = await fetch(`${GITHUB_API}/repos/${repo}/hooks?per_page=100`, { headers: githubHeaders(token) });
  if (list.status === 403 || list.status === 404) return { status: "no-permission" };
  if (!list.ok) throw new Error(`GitHub hooks list failed (${list.status})`);
  const hooks = (await list.json()) as { config?: { url?: string } }[];
  if (hooks.some((h) => h.config?.url === url)) return { status: "exists" };

  const res = await fetch(`${GITHUB_API}/repos/${repo}/hooks`, {
    method: "POST",
    headers: githubHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      name: "web",
      active: true,
      events: WEBHOOK_EVENTS,
      config: { url, content_type: "json", secret, insecure_ssl: "0" },
    }),
  });
  if (res.status === 403 || res.status === 404) return { status: "no-permission" };
  if (!res.ok) throw new Error(`GitHub hook create failed (${res.status})`);
  return { status: "created", id: ((await res.json()) as { id: number }).id };
}

/** Remove a hook we created. Already-gone hooks count as success. */
export async function deleteRepoWebhook(token: string, repo: string, hookId: number): Promise<void> {
  if (!REPO_FULL_NAME.test(repo)) throw new Error("invalid repo");
  const res = await fetch(`${GITHUB_API}/repos/${repo}/hooks/${hookId}`, {
    method: "DELETE",
    headers: githubHeaders(token),
  });
  if (!res.ok && res.status !== 404) throw new Error(`GitHub hook delete failed (${res.status})`);
}

/**
 * Public URL GitHub should deliver to, or null when this deployment can't be
 * reached from the internet (local dev) — registering localhost would just
 * produce a failing hook on the user's repo.
 */
export function publicWebhookUrl(requestOrigin: string): string | null {
  const origin = (process.env.NEXT_PUBLIC_APP_URL || requestOrigin).replace(/\/+$/, "");
  let host: string;
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "https:") return null;
    host = parsed.hostname;
  } catch {
    return null;
  }
  if (host === "localhost" || host.endsWith(".local") || /^(127\.|10\.|192\.168\.)/.test(host)) return null;
  return `${origin}/api/github/webhook`;
}
