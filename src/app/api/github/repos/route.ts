import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { fetchGitHubRepos } from "@/lib/github";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "not-configured" }, { status: 501 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (!workspace) return NextResponse.json({ error: "no-workspace" }, { status: 400 });

  const { data: integration } = await supabase
    .from("integrations")
    .select("access_token")
    .eq("workspace_id", workspace.id)
    .eq("provider", "github")
    .maybeSingle();
  if (!integration) return NextResponse.json({ error: "not-connected" }, { status: 400 });

  try {
    const repos = await fetchGitHubRepos(integration.access_token);
    return NextResponse.json(
      repos.map((r) => ({
        full_name: r.full_name,
        html_url: r.html_url,
        description: r.description,
        open_issues_count: r.open_issues_count,
        private: r.private,
      }))
    );
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
