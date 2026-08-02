import { NextResponse, type NextRequest } from "next/server";

import { requireWorkspace } from "@/lib/supabase/auth";
import type { ChatThread } from "@/types/database";

export async function GET() {
  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  const { data, error } = await supabase
    .from("chat_threads")
    .select("*")
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: "list-failed" }, { status: 500 });

  return NextResponse.json((data ?? []) as ChatThread[]);
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { title?: string } | null;

  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  const { data, error } = await supabase
    .from("chat_threads")
    .insert({ workspace_id: workspace.id, title: body?.title?.trim() || "New chat" })
    .select()
    .single();
  if (error || !data) return NextResponse.json({ error: "create-failed" }, { status: 500 });

  return NextResponse.json(data as ChatThread, { status: 201 });
}
