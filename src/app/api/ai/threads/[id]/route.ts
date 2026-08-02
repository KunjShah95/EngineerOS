import { NextResponse } from "next/server";

import { requireWorkspace } from "@/lib/supabase/auth";
import type { ChatMessage } from "@/types/database";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;

  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  const { data: thread } = await supabase
    .from("chat_threads")
    .select("workspace_id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!thread) return NextResponse.json({ error: "thread-not-found" }, { status: 404 });

  // The thread must belong to the caller's single active workspace (stricter
  // than the old owner-only query — RLS would block deleted-workspace rows
  // anyway, so this is just defense in depth).
  if (thread.workspace_id !== workspace.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("thread_id", id)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: "load-failed" }, { status: 500 });

  return NextResponse.json((data ?? []) as ChatMessage[]);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;

  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  const { data: thread } = await supabase
    .from("chat_threads")
    .select("workspace_id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!thread) return NextResponse.json({ error: "thread-not-found" }, { status: 404 });

  // The thread must belong to the caller's single active workspace (stricter
  // than the old owner-only query — RLS would block deleted-workspace rows
  // anyway, so this is just defense in depth).
  if (thread.workspace_id !== workspace.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { error } = await supabase.from("chat_threads").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return NextResponse.json({ error: "delete-failed" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
