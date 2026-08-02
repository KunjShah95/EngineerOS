import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { fetchGitHubIssues } from "@/lib/github";

export async function GET(request: NextRequest) {
  const repo = request.nextUrl.searchParams.get("repo");
  if (!repo) return NextResponse.json({ error: "missing repo" }, { status: 400 });

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
    const issues = await fetchGitHubIssues(integration.access_token, repo);
    return NextResponse.json(
      issues.map((i) => ({
        number: i.number,
        title: i.title,
        html_url: i.html_url,
        body: i.body,
        labels: i.labels.map((l) => l.name),
      }))
    );
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
