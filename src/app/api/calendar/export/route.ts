import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { buildIcs } from "@/lib/ics";

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

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("id, title, description, due_date, source_url")
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null)
    .not("due_date", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ics = buildIcs(
    (tasks ?? []).map((t) => ({
      uid: t.id,
      title: t.title,
      description: t.description ?? undefined,
      url: t.source_url ?? undefined,
      date: t.due_date,
    }))
  );

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="engineeros-tasks.ics"',
    },
  });
}
