import { NextResponse, type NextRequest } from "next/server";

import { requireWorkspace } from "@/lib/supabase/auth";
import { answerWithContext, drainIndexQueue, retrieveWorkspace } from "@/lib/ai/rag";
import { loadAiConfig } from "@/lib/ai/db-config";
import { runWithAiConfig } from "@/lib/ai/server-config";
import type { ChatSource } from "@/types/database";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    thread_id?: string;
    question?: string;
  } | null;
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const question = (body.question ?? "").trim();
  if (!question) return NextResponse.json({ error: "missing question" }, { status: 400 });

  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  // Resolve or create the thread.
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
      .insert({ workspace_id: workspace.id, title: question.slice(0, 48) })
      .select("id")
      .single();
    if (error || !thread) return NextResponse.json({ error: "thread-create-failed" }, { status: 500 });
    threadId = thread.id;
  }

  // Pull recent history for context.
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

  // Persist the user's question up front so history stays consistent even if
  // generation fails.
  const { error: userInsertError } = await supabase.from("chat_messages").insert({
    thread_id: threadId,
    role: "user",
    content: question,
  });
  if (userInsertError) {
    return NextResponse.json({ error: "persist-failed" }, { status: 500 });
  }

  try {
    const aiConfig = await loadAiConfig(supabase, workspace.id);
    return await runWithAiConfig(aiConfig, async () => {
      // Drain any pending index changes so the answer reflects the latest edits
      // (cheap when the queue is empty — the background hook usually keeps up).
      await drainIndexQueue(supabase, workspace.id, 20);
      const chunks = await retrieveWorkspace(supabase, workspace.id, question);
      const result = await answerWithContext(question, chunks, history);

      // Persist the assistant reply; a DB hiccup here shouldn't discard the
      // answer, so surface it with a warning flag instead of failing.
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
