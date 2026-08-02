import { NextResponse, type NextRequest } from "next/server";

import { requireWorkspace, type Supabase } from "@/lib/supabase/auth";
import { embedQuery, isEmbeddingConfigured } from "@/lib/ai/embeddings";
import type { SemanticMatch } from "@/types/database";

type RpcRow = {
  entity_type: SemanticMatch["entity_type"];
  entity_id: string;
  chunk_index: number;
  content: string;
  score: number;
};

/**
 * Attach routing metadata that the RPC doesn't return: resource kind (so the
 * palette can link to /code/:id etc.) and daily-note date (for /daily/:date).
 */
async function enrichMatches(
  supabase: Supabase,
  workspaceId: string,
  matches: SemanticMatch[]
): Promise<SemanticMatch[]> {
  const resourceIds = matches.filter((m) => m.entity_type === "resource").map((m) => m.entity_id);
  if (resourceIds.length > 0) {
    const { data: resources } = await supabase
      .from("resources")
      .select("id, kind")
      .eq("workspace_id", workspaceId)
      .in("id", resourceIds);
    const kindById = new Map((resources ?? []).map((r) => [r.id, r.kind]));
    for (const m of matches) if (m.entity_type === "resource") m.kind = kindById.get(m.entity_id) ?? null;
  }

  const dailyIds = matches.filter((m) => m.entity_type === "daily_note").map((m) => m.entity_id);
  if (dailyIds.length > 0) {
    const { data: dailies } = await supabase
      .from("daily_notes")
      .select("id, date")
      .eq("workspace_id", workspaceId)
      .in("id", dailyIds);
    const dateById = new Map((dailies ?? []).map((d) => [d.id, d.date]));
    for (const m of matches) if (m.entity_type === "daily_note") m.date = dateById.get(m.entity_id) ?? null;
  }

  return matches;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { query?: string; limit?: number } | null;
  const query = (body?.query ?? "").trim();
  if (!query || query.length < 2) return NextResponse.json({ error: "query-too-short" }, { status: 400 });

  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

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
    const matches = ((data as RpcRow[] | null) ?? []).map((r) => ({
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      chunk_index: r.chunk_index,
      content: r.content,
      score: r.score,
    }));
    return NextResponse.json({
      mode: "embeddings",
      chunks: await enrichMatches(supabase, workspace.id, matches),
    });
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