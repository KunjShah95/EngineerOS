import { NextResponse } from "next/server";

import { requireWorkspace } from "@/lib/supabase/auth";
import { backfillVersions } from "@/lib/ai/version-backfill";

export const maxDuration = 120;

/**
 * Seed note_versions for notes that predate versioning, so time-travel answers
 * can reconstruct more than just "no snapshot". Safe to re-run: notes that
 * already have history are skipped.
 */
export async function POST() {
  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  try {
    const result = await backfillVersions(supabase, workspace.id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
