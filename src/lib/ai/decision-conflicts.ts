// Stale-decision alerts: does a new decision reverse an earlier one?
//
// Candidates come from findRelatedDecisions (semantic or keyword), then one
// model call judges all of them at once. Only "supersedes" / "conflicts" are
// stored; the human decides whether the earlier record is really out of date.

import { isAiConfigured } from "../ai";
import { resolveProvider } from "./providers";
import { findRelatedDecisions, type RelatedDecision } from "./related-decisions";
import type { Supabase } from "@/lib/supabase/auth";

export type ConflictRelation = "supersedes" | "conflicts";

export interface ConflictVerdict {
  earlierId: string;
  relation: ConflictRelation;
  reason: string;
}

export const CONFLICT_SYSTEM_PROMPT = `You compare a NEW engineering decision with EARLIER decisions from the same team.

For each earlier decision, classify the relation:
- "supersedes": the new decision replaces or reverses it (e.g. earlier "no Redis", new "add Redis cache").
- "conflicts": both can't be true at once, but the new one doesn't clearly replace it.
- "none": compatible, unrelated, or merely on the same topic.

Be conservative: same topic is NOT a conflict. Only flag when following one would violate the other.

Return ONLY JSON, no prose, no code fences:
{"results": [{"index": <earlier decision number>, "relation": "supersedes" | "conflicts" | "none", "reason": "<one sentence>"}]}`;

interface DecisionText {
  title: string;
  decision: string;
  context: string;
}

export function buildConflictPrompt(next: DecisionText, earlier: DecisionText[]): string {
  const fmt = (d: DecisionText) =>
    `Title: ${d.title}\nDecision: ${d.decision}${d.context ? `\nContext: ${d.context}` : ""}`;
  return [
    `NEW decision:\n${fmt(next)}`,
    ...earlier.map((d, i) => `EARLIER decision ${i + 1}:\n${fmt(d)}`),
  ].join("\n\n");
}

/**
 * Parse the model's verdicts against the candidates it was shown. Indexes are
 * 1-based as presented; anything out of range, duplicated, or not a real
 * conflict is dropped. Unusable replies yield no alerts rather than an error.
 */
export function parseConflictReply(raw: string, earlierIds: string[]): ConflictVerdict[] {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return [];
  let json: { results?: unknown };
  try {
    json = JSON.parse(raw.slice(start, end + 1)) as { results?: unknown };
  } catch {
    return [];
  }
  if (!Array.isArray(json.results)) return [];

  const seen = new Set<string>();
  const verdicts: ConflictVerdict[] = [];
  for (const item of json.results) {
    const r = (item ?? {}) as Record<string, unknown>;
    const index = typeof r.index === "number" ? r.index : Number(r.index);
    const earlierId = Number.isInteger(index) ? earlierIds[index - 1] : undefined;
    if (!earlierId || seen.has(earlierId)) continue;
    if (r.relation !== "supersedes" && r.relation !== "conflicts") continue;
    seen.add(earlierId);
    verdicts.push({
      earlierId,
      relation: r.relation,
      reason: typeof r.reason === "string" ? r.reason.trim().slice(0, 500) : "",
    });
  }
  return verdicts;
}

/**
 * Check a freshly saved decision against related earlier ones and store any
 * suspected reversals. Must run inside runWithAiConfig. Replaces this
 * decision's previous open alerts (re-extraction may change the verdict) but
 * keeps resolved ones, so a dismissed alert doesn't come back.
 */
export async function detectDecisionConflicts(
  supabase: Supabase,
  workspaceId: string,
  record: { id: string; note_id: string } & DecisionText,
): Promise<ConflictVerdict[]> {
  if (!isAiConfigured()) return [];

  const { decisions: related } = await findRelatedDecisions(
    supabase,
    workspaceId,
    `${record.title}\n${record.decision}\n${record.context}`,
    { limit: 5, excludeNoteId: record.note_id },
  );
  const earlier = related.filter((d: RelatedDecision) => d.id !== record.id);

  await supabase.from("decision_conflicts").delete().eq("decision_id", record.id).eq("status", "open");
  if (earlier.length === 0) return [];

  const { data: resolved } = await supabase
    .from("decision_conflicts")
    .select("earlier_decision_id")
    .eq("decision_id", record.id)
    .neq("status", "open");
  const alreadyResolved = new Set(((resolved ?? []) as { earlier_decision_id: string }[]).map((r) => r.earlier_decision_id));

  const reply = await resolveProvider().chat(
    [
      { role: "system", content: CONFLICT_SYSTEM_PROMPT },
      { role: "user", content: buildConflictPrompt(record, earlier) },
    ],
    600,
  );
  const verdicts = parseConflictReply(reply, earlier.map((d) => d.id)).filter((v) => !alreadyResolved.has(v.earlierId));
  if (verdicts.length === 0) return [];

  const { error } = await supabase.from("decision_conflicts").insert(
    verdicts.map((v) => ({
      workspace_id: workspaceId,
      decision_id: record.id,
      earlier_decision_id: v.earlierId,
      relation: v.relation,
      reason: v.reason,
    })),
  );
  if (error) throw error;
  return verdicts;
}
