import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { after, NextResponse } from "next/server";

import { drainIndexQueue } from "@/lib/ai/rag";
import { loadAiConfig } from "@/lib/ai/db-config";
import { runWithAiConfig } from "@/lib/ai/server-config";
import {
  closingIssueUrls,
  isMergedPullRequest,
  issueEventToTaskPatch,
  pullRequestToNote,
  verifyGitHubSignature,
  type GitHubIssuePayload,
  type GitHubPullRequestPayload,
  type LinkedTask,
} from "@/lib/github-webhook";
import { log } from "@/lib/logger";

// GitHub waits 10s for a response, so the route only does the DB write;
// re-embedding runs in after() within this budget.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * GitHub → EngineerOS sync. Point a repo (or org) webhook at this route with
 * content type application/json, the "Issues" and "Pull requests" events, and
 * GITHUB_WEBHOOK_SECRET as the secret.
 *
 * - issues: keeps imported tasks in sync with their issues.
 * - pull_request: a merged PR becomes a decision note in every workspace that
 *   linked the repo (github_repo_links), so the "why" is captured without
 *   anyone filing it.
 *
 * Writes fire the index_queue trigger; we drain the affected workspaces right
 * after responding so search reflects the change in seconds.
 *
 * Service role: deliveries aren't tied to a signed-in user and can fan out to
 * several workspaces. The HMAC check is what authorizes the write, and each
 * handler only touches rows already linked to the delivery (by issue URL, or
 * by a repo link that was access-checked when created).
 */
export async function POST(request: Request) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !url || !serviceKey) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  // Signature is over the raw bytes, so read text before parsing.
  const rawBody = await request.text();
  if (!verifyGitHubSignature(secret, rawBody, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const event = request.headers.get("x-github-event");
  if (event === "ping") return NextResponse.json({ ok: true, pong: true });
  if (event !== "issues" && event !== "pull_request") return NextResponse.json({ ok: true, ignored: event });

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const result =
    event === "issues"
      ? await handleIssue(admin, payload as GitHubIssuePayload)
      : await handlePullRequest(admin, payload as GitHubPullRequestPayload);
  if ("error" in result) {
    // Non-2xx so the delivery shows as failed in GitHub and can be redelivered.
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  if (result.workspaceIds.length > 0) after(() => drainWorkspaces(admin, result.workspaceIds));
  return NextResponse.json({ ok: true, ...result.summary });
}

type HandlerResult =
  | { workspaceIds: string[]; summary: Record<string, unknown> }
  | { error: string };

async function handleIssue(admin: SupabaseClient, payload: GitHubIssuePayload): Promise<HandlerResult> {
  const patch = issueEventToTaskPatch(payload);
  if (!patch || !payload.issue) return { workspaceIds: [], summary: { ignored: payload.action } };

  const { data: updated, error } = await admin
    .from("tasks")
    .update(patch)
    .eq("source_url", payload.issue.html_url)
    .is("deleted_at", null)
    .select("workspace_id");
  if (error) {
    log("error", "github webhook — task update failed", { issue: payload.issue.html_url, error: error.message });
    return { error: "update failed" };
  }

  return {
    workspaceIds: unique((updated ?? []).map((r) => r.workspace_id as string)),
    summary: { action: payload.action, tasks: updated?.length ?? 0 },
  };
}

async function handlePullRequest(admin: SupabaseClient, payload: GitHubPullRequestPayload): Promise<HandlerResult> {
  if (!isMergedPullRequest(payload)) return { workspaceIds: [], summary: { ignored: payload.action } };
  const pr = payload.pull_request!;
  const repo = payload.repository!.full_name;

  const { data: links, error: linksError } = await admin
    .from("github_repo_links")
    .select("workspace_id")
    .eq("repo_full_name", repo.toLowerCase())
    .eq("capture_prs", true);
  if (linksError) {
    log("error", "github webhook — repo link lookup failed", { repo, error: linksError.message });
    return { error: "lookup failed" };
  }
  if (!links || links.length === 0) return { workspaceIds: [], summary: { ignored: "repo-not-linked" } };

  const issueUrls = closingIssueUrls(pr.body, repo);
  const created: string[] = [];

  for (const { workspace_id: workspaceId } of links as { workspace_id: string }[]) {
    let linkedTasks: LinkedTask[] = [];
    if (issueUrls.length > 0) {
      const { data } = await admin
        .from("tasks")
        .select("id, title, source_url")
        .eq("workspace_id", workspaceId)
        .in("source_url", issueUrls)
        .is("deleted_at", null);
      linkedTasks = (data ?? []) as LinkedTask[];
    }

    const note = pullRequestToNote(payload, issueUrls, linkedTasks);
    // ignoreDuplicates: a redelivery must not overwrite a note the user has
    // since edited, nor resurrect one they deleted.
    const { data, error } = await admin
      .from("notes")
      .upsert(
        { workspace_id: workspaceId, source_url: pr.html_url, ...note },
        { onConflict: "workspace_id,source_url", ignoreDuplicates: true },
      )
      .select("id");
    if (error) {
      log("error", "github webhook — PR note insert failed", { pr: pr.html_url, workspace: workspaceId, error: error.message });
      return { error: "insert failed" };
    }
    if (data && data.length > 0) created.push(workspaceId);
  }

  return { workspaceIds: created, summary: { action: "merged", notes: created.length } };
}

async function drainWorkspaces(admin: SupabaseClient, workspaceIds: string[]) {
  for (const workspaceId of workspaceIds) {
    try {
      const aiConfig = await loadAiConfig(admin, workspaceId);
      await runWithAiConfig(aiConfig, () => drainIndexQueue(admin, workspaceId));
    } catch (err) {
      // Queue rows stay put; the cron or next in-app drain retries them.
      log("warn", "github webhook — index drain failed", { workspace: workspaceId, error: (err as Error).message });
    }
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
