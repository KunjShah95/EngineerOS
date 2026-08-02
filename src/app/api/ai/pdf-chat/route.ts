import { NextResponse, type NextRequest } from "next/server";

import { requireWorkspace } from "@/lib/supabase/auth";
import { answerQuestion } from "@/lib/ai";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    document_id?: string;
    question?: string;
  } | null;

  if (!body?.document_id || !body?.question?.trim()) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  const { data: doc } = await supabase
    .from("pdf_documents")
    .select("id, workspace_id, text_content")
    .eq("id", body.document_id)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (!doc) return NextResponse.json({ error: "document-not-found" }, { status: 404 });

  try {
    const result = await answerQuestion(doc.text_content, body.question);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
