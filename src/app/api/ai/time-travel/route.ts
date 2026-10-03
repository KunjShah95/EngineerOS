import { NextResponse, type NextRequest } from "next/server";

import { requireWorkspace } from "@/lib/supabase/auth";
import { assertAiQuota, entitlementsFor } from "@/lib/saas/entitlements";
import { loadAiConfig } from "@/lib/ai/db-config";
import { runWithAiConfig } from "@/lib/ai/server-config";
import { answerTimeTravel, type AsOfDate } from "@/lib/ai/time-travel";
import type { ChatSource } from "@/types/database";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    thread_id?: string;
    question?: string;
    as_of?: string;
  } | null;
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const question = (body.question ?? "").trim();
  if (!question) return NextResponse.json({ error: "missing question" }, { status: 400 });

  const asOf = (body.as_of ?? "").trim();
  if (!ISO_DATE.test(asOf)) {
    return NextResponse.json({ error: "as_of must be a yyyy-mm-dd date" }, { status: 400 });
  }
  // A future pin date is meaningless — everything is "current" then, and the
  // user almost certainly meant a past date.
  if (asOf > new Date().toISOString().slice(0, 10)) {
    return NextResponse.json({ error: "as_of cannot be in the future" }, { status: 400 });
  }

  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  // Same gate as the normal assistant route — a time-travel answer costs the
  // same tokens and must not be a way around the plan limit.
  const quotaBlocked = await assertAiQuota(supabase, workspace, entitlementsFor(workspace));
  if (quotaBlocked) return quotaBlocked;

  let threadId = body.thread_id ?? null;
  if (threadId) {
    const { data: thread } = await supabase
      .from("chat_threads")
      .select("id")
      .eq("id", threadId)
      .eq("workspace_id", workspace.id)
      .maybeSingle();
    if (!thread) return NextResponse.json({ error: "thread-not-found" }, { status: 404 });
  } else {
    const { data: thread, error } = await supabase
      .from("chat_threads")
      .insert({ workspace_id: workspace.id, title: `${asOf}: ${question.slice(0, 40)}` })
      .select("id")
      .single();
    if (error || !thread) return NextResponse.json({ error: "thread-create-failed" }, { status: 500 });
    threadId = thread.id;
  }

  const { data: historyRows } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(20);
  const history = (historyRows ?? []).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Mark the question as pinned in the transcript so history is readable later
  // without needing the sources to explain what the date meant.
  const { error: userInsertError } = await supabase.from("chat_messages").insert({
    thread_id: threadId,
    role: "user",
    content: question,
    sources: [{ retrieval: "time-travel", as_of: asOf }] as ChatSource[],
  });
  if (userInsertError) {
    return NextResponse.json({ error: "persist-failed" }, { status: 500 });
  }

  try {
    const aiConfig = await loadAiConfig(supabase, workspace.id);
    return await runWithAiConfig(aiConfig, async () => {
      const result = await answerTimeTravel(
        supabase,
        workspace.id,
        question,
        asOf as AsOfDate,
        history
      );

      const { error: replyInsertError } = await supabase.from("chat_messages").insert({
        thread_id: threadId,
        role: "assistant",
        content: result.answer,
        sources: result.sources as ChatSource[],
        model: result.model,
      });

      return NextResponse.json({
        thread_id: threadId,
        ...result,
        persisted: !replyInsertError,
      });
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
