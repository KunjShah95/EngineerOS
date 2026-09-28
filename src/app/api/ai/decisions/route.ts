import { NextResponse, type NextRequest } from "next/server";

import { requireWorkspace } from "@/lib/supabase/auth";
import { extractDecisionForNote } from "@/lib/ai/decisions";
import { loadAiConfig } from "@/lib/ai/db-config";
import { runWithAiConfig } from "@/lib/ai/server-config";

export const maxDuration = 60;

/** Extract (or re-extract) the decision record for one note. */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { note_id?: unknown } | null;
  const noteId = typeof body?.note_id === "string" ? body.note_id : "";
  if (!noteId) return NextResponse.json({ error: "missing note_id" }, { status: 400 });

  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  try {
    const aiConfig = await loadAiConfig(supabase, workspace.id);
    const result = await runWithAiConfig(aiConfig, () => extractDecisionForNote(supabase, workspace.id, noteId));
    switch (result.status) {
      case "note-not-found":
        return NextResponse.json({ error: "note-not-found" }, { status: 404 });
      case "no-ai":
        return NextResponse.json({ error: "no-ai" }, { status: 422 });
      default:
        return NextResponse.json(result);
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
