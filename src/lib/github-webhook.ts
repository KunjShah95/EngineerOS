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
