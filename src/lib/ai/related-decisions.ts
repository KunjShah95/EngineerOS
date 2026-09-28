// Find past decisions related to some text. Shared by the "decided before"
// hint in the task dialog and by conflict detection on new decisions.

import { embedQuery, isEmbeddingConfigured } from "./embeddings";
import { rankByTermHits, topicTerms } from "@/lib/decision-context";
import type { Supabase } from "@/lib/supabase/auth";
import type { DecisionRecord } from "@/types/database";

// Cosine floor for "related". Below this, nearest neighbours in a small
// workspace are just whatever exists, and showing them trains people to
// ignore the hint.
export const RELATED_MIN_SCORE = 0.3;

export type RelatedDecision = Pick<
  DecisionRecord,
  "id" | "note_id" | "title" | "decision" | "context" | "source_url" | "created_at"
>;
const COLUMNS = "id, note_id, title, decision, context, source_url, created_at";

/**
 * Semantic when embeddings are configured (decisions are found through their
 * source notes' chunks), keyword otherwise or if the RPC is unavailable.
 * Must run inside runWithAiConfig. Only active decisions are returned —
 * superseded ones are history, not guidance.
 */
export async function findRelatedDecisions(
  supabase: Supabase,
  workspaceId: string,
  text: string,
  { limit = 3, excludeNoteId }: { limit?: number; excludeNoteId?: string } = {},
): Promise<{ decisions: RelatedDecision[]; mode: "semantic" | "keyword" }> {
  if (isEmbeddingConfigured()) {
    const embedding = await embedQuery(text);
    const { data: matches, error } = await supabase.rpc("semantic_search", {
      q_workspace: workspaceId,
      q_embedding: embedding,
      q_limit: 30,
    });
    if (!error) {
      // Best score per note, in rank order.
      const noteIds: string[] = [];
      for (const m of (matches ?? []) as { entity_type: string; entity_id: string; score: number }[]) {
        if (
          m.entity_type === "note" &&
          m.score >= RELATED_MIN_SCORE &&
          m.entity_id !== excludeNoteId &&
          !noteIds.includes(m.entity_id)
        ) {
          noteIds.push(m.entity_id);
        }
      }
      if (noteIds.length === 0) return { decisions: [], mode: "semantic" };

      const { data: records } = await supabase
        .from("decision_records")
        .select(COLUMNS)
        .eq("workspace_id", workspaceId)
        .eq("status", "active")
        .in("note_id", noteIds);
      const byNote = new Map(((records ?? []) as RelatedDecision[]).map((r) => [r.note_id, r]));
      return { decisions: noteIds.flatMap((id) => byNote.get(id) ?? []).slice(0, limit), mode: "semantic" };
    }
  }

  const terms = topicTerms(text);
  if (terms.length === 0) return { decisions: [], mode: "keyword" };
  // Terms are [a-z0-9] only (topicTerms), so splicing them into the or()
  // filter can't inject PostgREST syntax.
  const orFilter = terms.flatMap((t) => [`title.ilike.%${t}%`, `decision.ilike.%${t}%`, `context.ilike.%${t}%`]).join(",");
  let query = supabase
    .from("decision_records")
    .select(COLUMNS)
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .or(orFilter)
    .limit(50);
  if (excludeNoteId) query = query.neq("note_id", excludeNoteId);
  const { data: candidates } = await query;
  return { decisions: rankByTermHits((candidates ?? []) as RelatedDecision[], terms, limit), mode: "keyword" };
}
