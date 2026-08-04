import { NextResponse, type NextRequest } from "next/server";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string; numpages: number }>;

import { requireWorkspace } from "@/lib/supabase/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing file" }, { status: 400 });
  }
  if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "not a PDF" }, { status: 400 });
  }
  // Guard against memory exhaustion — PDFs above 25MB are rejected up front.
  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "PDF too large (max 25MB)" }, { status: 413 });
  }

  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  // Optional project assignment — must be a real uuid that belongs to this workspace.
  let projectId: string | null = null;
  const rawProjectId = form?.get("project_id");
  if (typeof rawProjectId === "string" && rawProjectId.trim()) {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(rawProjectId)) {
      return NextResponse.json({ error: "invalid project_id" }, { status: 400 });
    }
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", rawProjectId)
      .eq("workspace_id", workspace.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!project) return NextResponse.json({ error: "project not found" }, { status: 400 });
    projectId = rawProjectId;
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await pdfParse(buffer);

    const text = result.text ?? "";
    if (text.trim().length < 20) {
      return NextResponse.json({ error: "No extractable text in this PDF (scanned images?)." }, { status: 422 });
    }

    // Also keep the original file in the private pdfs bucket.
    const storagePath = `${workspace.id}/${crypto.randomUUID()}.pdf`;
    const { error: upError } = await supabase.storage
      .from("pdfs")
      .upload(storagePath, file, { contentType: "application/pdf" });
    if (upError) throw upError;

    const { data, error } = await supabase
      .from("pdf_documents")
      .insert({
        workspace_id: workspace.id,
        project_id: projectId,
        title: file.name.replace(/\.pdf$/i, ""),
        storage_path: storagePath,
        text_content: text,
        char_count: text.length,
      })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ document: data });
  } catch (err) {
    console.error("PDF ingest failed:", err);
    return NextResponse.json({ error: "Failed to process PDF" }, { status: 500 });
  }
}
