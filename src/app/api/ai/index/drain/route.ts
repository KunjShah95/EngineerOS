import { NextResponse } from "next/server";

import { requireWorkspace } from "@/lib/supabase/auth";
import { drainIndexQueue } from "@/lib/ai/rag";
import { loadAiConfig } from "@/lib/ai/db-config";
import { runWithAiConfig } from "@/lib/ai/server-config";

export const maxDuration = 60;

export async function POST() {
  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  try {
    const aiConfig = await loadAiConfig(supabase, workspace.id);
    const result = await runWithAiConfig(aiConfig, () => drainIndexQueue(supabase, workspace.id));
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
