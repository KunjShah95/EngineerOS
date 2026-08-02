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
