import { NextResponse, type NextRequest } from "next/server";

import { requireWorkspace } from "@/lib/supabase/auth";
import { fetchGitHubIssues } from "@/lib/github";

export async function GET(request: NextRequest) {
  const repo = request.nextUrl.searchParams.get("repo");
  if (!repo) return NextResponse.json({ error: "missing repo" }, { status: 400 });

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
