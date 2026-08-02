import { NextResponse, type NextRequest } from "next/server";
import { PDFParse } from "pdf-parse";

import { createClient } from "@/lib/supabase/server";

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

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();

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
