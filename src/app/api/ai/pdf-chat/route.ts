import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { answerQuestion } from "@/lib/ai";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    document_id?: string;
    question?: string;
  } | null;

  if (!body?.document_id || !body?.question?.trim()) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "not-configured" }, { status: 501 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (!workspace) return NextResponse.json({ error: "no-workspace" }, { status: 400 });

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
