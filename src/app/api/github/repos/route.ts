import { NextResponse } from "next/server";

import { requireWorkspace } from "@/lib/supabase/auth";
import { fetchGitHubRepos } from "@/lib/github";

export async function GET() {
  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

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
