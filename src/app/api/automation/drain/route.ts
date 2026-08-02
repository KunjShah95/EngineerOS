import { NextResponse } from "next/server";

import { requireWorkspace } from "@/lib/supabase/auth";
import { drainAutomation } from "@/lib/automation";
import { log } from "@/lib/logger";

export const maxDuration = 60;

export async function POST() {
  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  try {
    const result = await drainAutomation(supabase, workspace.id);
    log("info", "automation drain complete", { workspace: workspace.id, ...result });
    return NextResponse.json(result);
  } catch (err) {
    log("error", "automation drain failed", { workspace: workspace.id, error: (err as Error).message });
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
