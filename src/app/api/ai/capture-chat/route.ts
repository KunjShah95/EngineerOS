import { NextResponse, type NextRequest } from "next/server";

import { requireWorkspace } from "@/lib/supabase/auth";
import { extractDecisionForNote } from "@/lib/ai/decisions";
import { loadAiConfig } from "@/lib/ai/db-config";
import { runWithAiConfig } from "@/lib/ai/server-config";
import { CHAT_MAX_CHARS, CHAT_MIN_CHARS, chatCaptureNote } from "@/lib/decision-context";

export const maxDuration = 60;

/**
 * Paste a ChatGPT / Claude / Slack thread; keep the reasoning.
 *
 * The transcript is always saved as a note first (so it's searchable even with
 * no AI key or when extraction fails), then a decision record is extracted
 * from it. When one is found, the note takes the decision's title — "Chat
 * capture — 2026-09-28" is useless in a list.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { text?: unknown; source?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const source = typeof body?.source === "string" ? body.source : "";
  if (text.length < CHAT_MIN_CHARS) return NextResponse.json({ error: "too-short" }, { status: 400 });
  if (text.length > CHAT_MAX_CHARS) return NextResponse.json({ error: "too-long" }, { status: 413 });

  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  const note = chatCaptureNote(text, source);
  const { data: created, error } = await supabase
    .from("notes")
    .insert({ workspace_id: workspace.id, ...note })
    .select("id")
    .single();
  if (error || !created) {
    return NextResponse.json({ error: error?.message ?? "insert failed" }, { status: 500 });
  }
  const noteId = (created as { id: string }).id;

  try {
    const aiConfig = await loadAiConfig(supabase, workspace.id);
    const result = await runWithAiConfig(aiConfig, () => extractDecisionForNote(supabase, workspace.id, noteId));
    if (result.status === "saved") {
      await supabase.from("notes").update({ title: result.draft.title }).eq("id", noteId).eq("workspace_id", workspace.id);
    }
    return NextResponse.json({ note_id: noteId, decision: result.status });
  } catch {
    // The note is saved; the decision can be re-extracted from it later.
    return NextResponse.json({ note_id: noteId, decision: "failed" });
  }
}
