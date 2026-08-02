import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { embedQuery, isEmbeddingConfigured } from "@/lib/ai/embeddings";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { query?: string; limit?: number } | null;
  const query = (body?.query ?? "").trim();
  if (!query || query.length < 2) return NextResponse.json({ error: "query-too-short" }, { status: 400 });

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "not-configured" }, { status: 501 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (!workspace) return NextResponse.json({ error: "no-workspace" }, { status: 400 });

  // Embed the query. On the no-key path this is a local fingerprint vector;
  // on a configured-API failure we DON'T fall back (throws) — we degrade to a
  // keyword-mode response the client understands instead.
  if (!isEmbeddingConfigured()) {
    return NextResponse.json({ mode: "local-keyword", chunks: [] }, { status: 200 });
  }

  let embedding: number[];
  try {
    embedding = await embedQuery(query);
  } catch {
    return NextResponse.json({ mode: "local-keyword", chunks: [] }, { status: 200 });
  }

  const limit = Number.isFinite(body?.limit) ? Math.min(Math.max(Math.floor(body?.limit ?? 12), 1), 50) : 12;

  try {
    const { data, error } = await supabase.rpc("semantic_search", {
      q_workspace: workspace.id,
      q_embedding: embedding,
      q_limit: limit,
    });
    if (error) throw error;
    return NextResponse.json({ mode: "embeddings", chunks: (data as unknown[]) ?? [] });
  } catch (error) {
    const message = (error as Error)?.message ?? "";
    const code = (error as { code?: unknown })?.code;
    const looksMissing = message.includes("does not exist") || message.includes("function") || code === "PGRST202" || code === "42883";

    if (!looksMissing) {
      console.error("[semantic-search]", error);
      return NextResponse.json(
        { error: "semantic-search-failed", detail: message, mode: "error" },
        { status: 500 },
      );
    }

    // The RPC/migration isn't installed yet — signal local mode; the
    // client-side keyword retriever (Task 5) fills results.
    return NextResponse.json({ mode: "local-keyword", chunks: [] }, { status: 200 });
  }
}