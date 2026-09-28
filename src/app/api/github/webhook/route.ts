import { createClient } from "@supabase/supabase-js";
import { after, NextResponse } from "next/server";

import { drainIndexQueue } from "@/lib/ai/rag";
import { loadAiConfig } from "@/lib/ai/db-config";
import { runWithAiConfig } from "@/lib/ai/server-config";
import { issueEventToTaskPatch, verifyGitHubSignature, type GitHubIssuePayload } from "@/lib/github-webhook";
import { log } from "@/lib/logger";

// GitHub waits 10s for a response, so the route only applies the task patch;
// re-embedding runs in after() within this budget.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Keeps GitHub-imported tasks in sync with their issues. Point a repo (or org)
 * webhook at this route with content type application/json, the "Issues"
 * event, and GITHUB_WEBHOOK_SECRET as the secret.
 *
 * Updating the task fires the index_queue trigger; we drain the affected
 * workspaces right after responding so search reflects the change in seconds
 * instead of waiting for someone to open the app.
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
  if (event !== "issues") return NextResponse.json({ ok: true, ignored: event });

  let payload: GitHubIssuePayload;
  try {
    payload = JSON.parse(rawBody) as GitHubIssuePayload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const patch = issueEventToTaskPatch(payload);
  if (!patch || !payload.issue) return NextResponse.json({ ok: true, ignored: payload.action });

  // Service role: the delivery isn't tied to a signed-in user, and the same
  // issue may be imported into several workspaces. The HMAC check above is
  // what authorizes this write; it only touches tasks already linked to the
  // issue URL.
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: updated, error } = await admin
    .from("tasks")
    .update(patch)
    .eq("source_url", payload.issue.html_url)
    .is("deleted_at", null)
    .select("workspace_id");
  if (error) {
    // Non-2xx so the delivery shows as failed in GitHub and can be redelivered.
    log("error", "github webhook — task update failed", { issue: payload.issue.html_url, error: error.message });
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }

  const workspaceIds = [...new Set((updated ?? []).map((r) => r.workspace_id as string))];
  if (workspaceIds.length > 0) {
    after(async () => {
      for (const workspaceId of workspaceIds) {
        try {
          const aiConfig = await loadAiConfig(admin, workspaceId);
          await runWithAiConfig(aiConfig, () => drainIndexQueue(admin, workspaceId));
        } catch (err) {
          // Queue rows stay put; the cron or next in-app drain retries them.
          log("warn", "github webhook — index drain failed", { workspace: workspaceId, error: (err as Error).message });
        }
      }
    });
  }

  return NextResponse.json({ ok: true, action: payload.action, tasks: updated?.length ?? 0 });
}
