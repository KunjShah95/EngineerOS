import { NextResponse, type NextRequest } from "next/server";

import { requireWorkspace } from "@/lib/supabase/auth";
import { summarizeText } from "@/lib/ai";
import { loadAiConfig } from "@/lib/ai/db-config";
import { runWithAiConfig } from "@/lib/ai/server-config";
import type { SummaryEntityType } from "@/types/database";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    entity_type?: SummaryEntityType;
    entity_id?: string;
  } | null;

  if (!body?.entity_type || !body?.entity_id) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  // Verify the entity belongs to this user's workspace before storing.
  const workspaceTable =
    body.entity_type === "task" ? "tasks" : body.entity_type === "daily_note" ? "daily_notes" : "notes";

  // Fetch the entity's own text server-side so the summary can't be gamed
  // into mismatching the note (ownership is already checked above).
  let text = "";
  if (body.entity_type === "daily_note") {
    const { data: entity } = await supabase
      .from("daily_notes")
      .select("date, morning_goals, journal, learned, wins, problems, tomorrow")
      .eq("id", body.entity_id)
      .eq("workspace_id", workspace.id)
      .maybeSingle();
    if (!entity) return NextResponse.json({ error: "entity-not-found" }, { status: 404 });
    text = Object.entries(entity)
      .filter(([k, v]) => k !== "date" && typeof v === "string" && v.trim())
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n\n");
  } else {
    const bodyCol = body.entity_type === "task" ? "description" : "body_markdown";
    const { data: entity } = await supabase
      .from(workspaceTable as "notes")
      .select(`id, workspace_id, title, ${bodyCol}`)
      .eq("id", body.entity_id)
      .eq("workspace_id", workspace.id)
      .maybeSingle();
    if (!entity) return NextResponse.json({ error: "entity-not-found" }, { status: 404 });
    const record = entity as unknown as Record<string, string | null>;
    text = [record.title, record[bodyCol]]
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .join("\n\n");
  }
  if (!text.trim()) {
    return NextResponse.json({ error: "nothing-to-summarize" }, { status: 422 });
  }

  try {
    const aiConfig = await loadAiConfig(supabase, workspace.id);
    const result = await runWithAiConfig(aiConfig, () => summarizeText(text));
    const { error } = await supabase.from("ai_summaries").upsert(
      {
        workspace_id: workspace.id,
        entity_type: body.entity_type,
        entity_id: body.entity_id,
        summary: result.summary,
        model: result.model,
      },
      { onConflict: "workspace_id,entity_type,entity_id" }
    );
    if (error) throw error;

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
