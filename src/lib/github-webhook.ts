// Server-only helpers for the GitHub webhook (/api/github/webhook).
//
// Imported issues become tasks keyed by `source_url` (the issue's html_url).
// Without a webhook those tasks are snapshots: edits, closes and reopens on
// GitHub never reach them, so search and the assistant answer from stale text.
// The route applies these patches to matching tasks; the existing index_queue
// trigger then re-embeds them.

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify GitHub's `X-Hub-Signature-256` header against the raw request body.
 * Must be computed over the exact bytes GitHub sent — never a re-serialized
 * JSON.parse result — or valid deliveries fail and forged ones may not.
 */
export function verifyGitHubSignature(secret: string, rawBody: string, header: string | null): boolean {
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export interface GitHubIssuePayload {
  action: string;
  issue?: {
    html_url: string;
    title: string;
    body: string | null;
    /** Set on pull requests delivered through the issues API; we skip those. */
    pull_request?: unknown;
  };
  changes?: { title?: unknown; body?: unknown };
}

export type TaskPatch = {
  title?: string;
  description?: string;
  status?: "todo" | "done";
  deleted_at?: string;
};

/** Same shape the importer writes (GitHubSection) so re-syncs look identical. */
export function issueDescription(htmlUrl: string, body: string | null): string {
  return `Imported from GitHub · ${htmlUrl}\n\n${body ?? ""}`.trim();
}

/**
 * Map an `issues` event to the task fields it changes, or null when the event
 * doesn't affect imported tasks (labels, assignees, milestones, ...).
 * `completed_at` is left to the touch_task_completed_at trigger.
 */
export function issueEventToTaskPatch(payload: GitHubIssuePayload, now = new Date()): TaskPatch | null {
  const issue = payload.issue;
  if (!issue || issue.pull_request) return null;

  switch (payload.action) {
    case "edited": {
      const patch: TaskPatch = {};
      if (payload.changes?.title) patch.title = issue.title;
      if (payload.changes?.body) patch.description = issueDescription(issue.html_url, issue.body);
      return Object.keys(patch).length > 0 ? patch : null;
    }
    case "closed":
      return { status: "done" };
    case "reopened":
      // The pre-close status isn't recorded anywhere; "todo" puts it back on
      // the active board without guessing it was in progress.
      return { status: "todo" };
    case "deleted":
      return { deleted_at: now.toISOString() };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Merged pull requests → decision notes
// ---------------------------------------------------------------------------

export interface GitHubPullRequestPayload {
  action: string;
  repository?: { full_name: string };
  pull_request?: {
    number: number;
    html_url: string;
    title: string;
    body: string | null;
    merged: boolean;
    merged_at: string | null;
    user: { login: string } | null;
    base: { ref: string };
  };
}

/** Only the final merge is worth a note; drafts and abandoned PRs are noise. */
export function isMergedPullRequest(payload: GitHubPullRequestPayload): boolean {
  return payload.action === "closed" && Boolean(payload.pull_request?.merged && payload.repository);
}

// GitHub's closing keywords: https://docs.github.com/en/issues/tracking-your-work-with-issues/linking-a-pull-request-to-an-issue
const CLOSING_REF = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s*:?\s+(?:([\w.-]+\/[\w.-]+))?#(\d+)\b/gi;

/**
 * Issue URLs a PR body closes ("Fixes #12", "resolves owner/repo#3"), in order
 * of first mention. Used to link the note to tasks imported from those issues.
 */
export function closingIssueUrls(body: string | null, repoFullName: string): string[] {
  const urls = new Set<string>();
  for (const match of (body ?? "").matchAll(CLOSING_REF)) {
    const repo = match[1] ?? repoFullName;
    urls.add(`https://github.com/${repo}/issues/${match[2]}`);
  }
  return [...urls];
}

/** Long PR bodies (logs, screenshots) would drown the chunk index. */
export const PR_BODY_LIMIT = 20_000;

export interface LinkedTask {
  id: string;
  title: string;
  source_url: string;
}

export function pullRequestToNote(
  payload: GitHubPullRequestPayload,
  issueUrls: string[],
  linkedTasks: LinkedTask[],
): { title: string; body_markdown: string } {
  const pr = payload.pull_request!;
  const repo = payload.repository!.full_name;

  const rawBody = (pr.body ?? "").trim();
  const body =
    rawBody.length > PR_BODY_LIMIT
      ? `${rawBody.slice(0, PR_BODY_LIMIT)}\n\n_…truncated — full description on GitHub._`
      : rawBody || "_No description provided._";

  const merged = pr.merged_at ? pr.merged_at.slice(0, 10) : "unknown date";
  const author = pr.user ? ` by @${pr.user.login}` : "";

  const lines = [
    `> Merged [${repo}#${pr.number}](${pr.html_url})${author} into \`${pr.base.ref}\` on ${merged}.`,
    "",
    "## Why",
    "",
    body,
  ];

  if (issueUrls.length > 0) {
    const taskByUrl = new Map(linkedTasks.map((t) => [t.source_url, t]));
    lines.push("", "## Closes", "");
    for (const url of issueUrls) {
      const ref = url.replace("https://github.com/", "").replace("/issues/", "#");
      const task = taskByUrl.get(url);
      lines.push(task ? `- [${ref}](${url}) · task: [${task.title}](/tasks?task=${task.id})` : `- [${ref}](${url})`);
    }
  }

  return { title: `PR #${pr.number}: ${pr.title}`, body_markdown: lines.join("\n") };
}
