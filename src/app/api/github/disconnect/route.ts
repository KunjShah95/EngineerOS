import { NextResponse } from "next/server";

import { requireWorkspace } from "@/lib/supabase/auth";

export async function POST() {
  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  const { error } = await supabase
    .from("integrations")
    .delete()
    .eq("workspace_id", workspace.id)
    .eq("provider", "github");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
