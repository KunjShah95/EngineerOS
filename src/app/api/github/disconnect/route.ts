import { NextResponse } from "next/server";

import { requireWorkspace } from "@/lib/supabase/auth";
import { isMissingSchemaError } from "@/lib/supabase/errors";

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

  // Repo links were authorized by the token we just dropped; without it we
  // can no longer vouch for access, so stop capturing PRs. Tolerate the table
  // not existing yet (migration not applied).
  const { error: linksError } = await supabase.from("github_repo_links").delete().eq("workspace_id", workspace.id);
  if (linksError && !isMissingSchemaError(linksError)) {
    return NextResponse.json({ error: linksError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
