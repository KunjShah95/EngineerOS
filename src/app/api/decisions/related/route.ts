import { NextResponse, type NextRequest } from "next/server";

import { requireWorkspace } from "@/lib/supabase/auth";
import { embedQuery, isEmbeddingConfigured } from "@/lib/ai/embeddings";
import { loadAiConfig } from "@/lib/ai/db-config";
import { runWithAiConfig } from "@/lib/ai/server-config";
import { rankByTermHits, topicTerms } from "@/lib/decision-context";
import type { DecisionRecord } from "@/types/database";

// Cosine floor for "related". Below this, nearest neighbours in a small
// workspace are just whatever exists, and showing them trains people to
// ignore the panel.
const MIN_SCORE = 0.3;
const LIMIT = 3;

type Related = Pick<DecisionRecord, "id" | "note_id" | "title" | "decision" | "context" | "source_url" | "created_at">;
const COLUMNS = "id, note_id, title, decision, context, source_url, created_at";

/**
 * "Ask before you build": past decisions related to a task being written.
 * Semantic when embeddings are configured (decisions are found through their
 * source notes' chunks), keyword otherwise. Always 200 with a list — this is
 * a hint panel, and failing loudly would block creating the task.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 1_000) : "";
  if (text.length < 8) return NextResponse.json({ decisions: [] });

  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  try {
    const aiConfig = await loadAiConfig(supabase, workspace.id);
    if (runWithAiConfig(aiConfig, () => isEmbeddingConfigured())) {
      const embedding = await runWithAiConfig(aiConfig, () => embedQuery(text));
      const { data: matches, error } = await supabase.rpc("semantic_search", {
        q_workspace: workspace.id,
        q_embedding: embedding,
        q_limit: 30,
      });
      if (!error) {
        // Best score per note, in rank order.
        const noteIds: string[] = [];
        for (const m of (matches ?? []) as { entity_type: string; entity_id: string; score: number }[]) {
          if (m.entity_type === "note" && m.score >= MIN_SCORE && !noteIds.includes(m.entity_id)) {
            noteIds.push(m.entity_id);
          }
        }
        if (noteIds.length === 0) return NextResponse.json({ decisions: [], mode: "semantic" });

        const { data: records } = await supabase
          .from("decision_records")
          .select(COLUMNS)
          .eq("workspace_id", workspace.id)
          .in("note_id", noteIds);
        const byNote = new Map(((records ?? []) as Related[]).map((r) => [r.note_id, r]));
        const decisions = noteIds.flatMap((id) => byNote.get(id) ?? []).slice(0, LIMIT);
        return NextResponse.json({ decisions, mode: "semantic" });
      }
      // RPC missing or failed: fall through to keywords.
    }

    const terms = topicTerms(text);
    if (terms.length === 0) return NextResponse.json({ decisions: [], mode: "keyword" });
    // Terms are [a-z0-9] only (topicTerms), so splicing them into the or()
    // filter can't inject PostgREST syntax.
    const orFilter = terms.flatMap((t) => [`title.ilike.%${t}%`, `decision.ilike.%${t}%`, `context.ilike.%${t}%`]).join(",");
    const { data: candidates } = await supabase
      .from("decision_records")
      .select(COLUMNS)
      .eq("workspace_id", workspace.id)
      .or(orFilter)
      .limit(50);
    const decisions = rankByTermHits((candidates ?? []) as Related[], terms, LIMIT);
    return NextResponse.json({ decisions, mode: "keyword" });
  } catch {
    return NextResponse.json({ decisions: [] });
  }
}
