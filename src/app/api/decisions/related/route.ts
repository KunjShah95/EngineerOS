import { NextResponse, type NextRequest } from "next/server";

import { requireWorkspace } from "@/lib/supabase/auth";
import { loadAiConfig } from "@/lib/ai/db-config";
import { findRelatedDecisions } from "@/lib/ai/related-decisions";
import { runWithAiConfig } from "@/lib/ai/server-config";

/**
 * "Ask before you build": past decisions related to a task being written.
 * Always 200 with a list — this is a hint panel, and failing loudly would
 * block creating the task.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 1_000) : "";
  if (text.length < 8) return NextResponse.json({ decisions: [] });

  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  try {
    const aiConfig = await loadAiConfig(supabase, workspace.id);
    const result = await runWithAiConfig(aiConfig, () => findRelatedDecisions(supabase, workspace.id, text));
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ decisions: [] });
  }
}
