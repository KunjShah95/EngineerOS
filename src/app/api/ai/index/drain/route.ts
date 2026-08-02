import { NextResponse } from "next/server";

import { requireWorkspace } from "@/lib/supabase/auth";
import { drainIndexQueue } from "@/lib/ai/rag";

export const maxDuration = 60;

export async function POST() {
  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  try {
    const result = await drainIndexQueue(supabase, workspace.id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
