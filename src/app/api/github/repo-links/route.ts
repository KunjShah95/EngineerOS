import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { requireWorkspace } from "@/lib/supabase/auth";
import { readableRepoName, REPO_FULL_NAME } from "@/lib/github";

/**
 * Opt a repository into PR capture (merged PRs → decision notes).
 *
 * Inserts go through here, not the client, because RLS deliberately has no
 * insert policy on github_repo_links: we first prove the workspace's GitHub
 * token can read the repo, then write with the service role.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { repo?: unknown } | null;
  const repo = typeof body?.repo === "string" ? body.repo.trim() : "";
  if (!REPO_FULL_NAME.test(repo)) return NextResponse.json({ error: "invalid repo" }, { status: 400 });

  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "not-configured" }, { status: 503 });
  }

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

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await admin
    .from("github_repo_links")
    .upsert(
      { workspace_id: workspace.id, repo_full_name: fullName.toLowerCase(), capture_prs: true },
      { onConflict: "workspace_id,repo_full_name" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, repo: fullName.toLowerCase() });
}

/** Stop capturing. Plain RLS delete — no access proof needed to opt out. */
export async function DELETE(request: NextRequest) {
  const repo = (request.nextUrl.searchParams.get("repo") ?? "").trim().toLowerCase();
  if (!REPO_FULL_NAME.test(repo)) return NextResponse.json({ error: "invalid repo" }, { status: 400 });

  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  const { error } = await supabase
    .from("github_repo_links")
    .delete()
    .eq("workspace_id", workspace.id)
    .eq("repo_full_name", repo);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
