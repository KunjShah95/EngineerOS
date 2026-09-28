import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { requireWorkspace } from "@/lib/supabase/auth";
import {
  deleteRepoWebhook,
  ensureRepoWebhook,
  publicWebhookUrl,
  readableRepoName,
  REPO_FULL_NAME,
  type EnsureWebhookResult,
} from "@/lib/github";
import { log } from "@/lib/logger";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** What the UI tells the user about delivery setup after linking. */
type WebhookStatus = EnsureWebhookResult["status"] | "not-public" | "no-secret" | "failed";

/**
 * Opt a repository into PR capture (merged PRs → decision notes) and, when
 * possible, register the GitHub webhook that delivers them.
 *
 * Inserts go through here, not the client, because RLS deliberately has no
 * insert policy on github_repo_links: we first prove the workspace's GitHub
 * token can read the repo, then write with the service role.
 *
 * Webhook registration is best-effort — the link is saved either way and the
 * response says whether the user still has to add the hook by hand.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { repo?: unknown } | null;
  const repo = typeof body?.repo === "string" ? body.repo.trim() : "";
  if (!REPO_FULL_NAME.test(repo)) return NextResponse.json({ error: "invalid repo" }, { status: 400 });

  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "not-configured" }, { status: 503 });

  const { data: integration } = await supabase
    .from("integrations")
    .select("access_token")
    .eq("workspace_id", workspace.id)
    .eq("provider", "github")
    .maybeSingle();
  if (!integration) return NextResponse.json({ error: "not-connected" }, { status: 400 });

  let fullName: string | null;
  try {
    fullName = await readableRepoName(integration.access_token, repo);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
  if (!fullName) return NextResponse.json({ error: "no-access" }, { status: 403 });
  const repoKey = fullName.toLowerCase();

  const { error } = await admin
    .from("github_repo_links")
    .upsert(
      { workspace_id: workspace.id, repo_full_name: repoKey, capture_prs: true },
      { onConflict: "workspace_id,repo_full_name" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let webhook: WebhookStatus;
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  const hookUrl = publicWebhookUrl(request.nextUrl.origin);
  if (!secret) webhook = "no-secret";
  else if (!hookUrl) webhook = "not-public";
  else {
    try {
      const result = await ensureRepoWebhook(integration.access_token, fullName, hookUrl, secret);
      webhook = result.status;
      if (result.status === "created") {
        await admin
          .from("github_repo_links")
          .update({ webhook_id: result.id })
          .eq("workspace_id", workspace.id)
          .eq("repo_full_name", repoKey);
      }
    } catch (err) {
      log("warn", "repo link — webhook registration failed", { repo: repoKey, error: (err as Error).message });
      webhook = "failed";
    }
  }

  return NextResponse.json({ ok: true, repo: repoKey, webhook });
}

/**
 * Stop capturing. The link delete is a plain RLS delete (no access proof
 * needed to opt out). If we created the repo's webhook and no other workspace
 * still links the repo, remove the hook too — best-effort.
 */
export async function DELETE(request: NextRequest) {
  const repo = (request.nextUrl.searchParams.get("repo") ?? "").trim().toLowerCase();
  if (!REPO_FULL_NAME.test(repo)) return NextResponse.json({ error: "invalid repo" }, { status: 400 });

  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  const { data: link } = await supabase
    .from("github_repo_links")
    .select("webhook_id")
    .eq("workspace_id", workspace.id)
    .eq("repo_full_name", repo)
    .maybeSingle();

  const { error } = await supabase
    .from("github_repo_links")
    .delete()
    .eq("workspace_id", workspace.id)
    .eq("repo_full_name", repo);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const hookId = (link as { webhook_id?: number | null } | null)?.webhook_id;
  const admin = adminClient();
  if (hookId && admin) {
    try {
      // Other workspaces are invisible under RLS, hence the service role.
      const { count } = await admin
        .from("github_repo_links")
        .select("workspace_id", { count: "exact", head: true })
        .eq("repo_full_name", repo);
      const { data: integration } = await supabase
        .from("integrations")
        .select("access_token")
        .eq("workspace_id", workspace.id)
        .eq("provider", "github")
        .maybeSingle();
      if (!count && integration) await deleteRepoWebhook(integration.access_token, repo, hookId);
    } catch (err) {
      log("warn", "repo unlink — webhook removal failed", { repo, error: (err as Error).message });
    }
  }

  return NextResponse.json({ ok: true });
}
