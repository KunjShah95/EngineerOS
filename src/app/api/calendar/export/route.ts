import { NextResponse } from "next/server";

import { requireWorkspace } from "@/lib/supabase/auth";
import { buildIcs } from "@/lib/ics";

export async function GET() {
  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

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
