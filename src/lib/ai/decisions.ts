// Decision records: pull a structured "why" out of a note.
//
// Merged-PR notes (GitHub webhook) and pasted chats hold the reasoning behind
// a change, but as prose. This asks the model for a lightweight ADR — the
// decision, the forcing context, rejected alternatives, accepted consequences
// and when to revisit — and stores it in decision_records so it can be listed,
// reviewed and later checked for staleness.
//
// Deliberately no local fallback: unlike a summary, a decision the text never
// states can't be approximated by extracting sentences, and a fabricated
// record is worse than none.

import { isAiConfigured } from "../ai";
import { resolveProvider } from "./providers";
import type { Supabase } from "@/lib/supabase/auth";

export interface DecisionAlternative {
  option: string;
  rejected_because: string;
}

export interface DecisionDraft {
  title: string;
  decision: string;
  context: string;
  alternatives: DecisionAlternative[];
  consequences: string;
  revisit_when: string;
}

/** Input sent to the model; long PR bodies are truncated upstream too. */
export const DECISION_INPUT_LIMIT = 12_000;

export const DECISION_SYSTEM_PROMPT = `You extract architecture/engineering decision records from notes, pull request descriptions and chat logs.

Return ONLY a JSON object, no prose, no code fences. Shape:
{"has_decision": boolean,
 "title": string,          // short imperative, e.g. "Use at-least-once delivery for the job queue"
 "decision": string,       // what was decided, 1-2 sentences
 "context": string,        // the problem or constraint that forced the choice
 "alternatives": [{"option": string, "rejected_because": string}],
 "consequences": string,   // trade-offs accepted, follow-ups created
 "revisit_when": string}   // condition that should trigger reconsidering it, or ""

Rules:
- Only use what the text states or clearly implies. Never invent alternatives, numbers or reasons; use "" or [] when absent.
- If the text records no real choice (routine bump, typo fix, formatting, empty description), return {"has_decision": false}.
- Write in the same language as the source.`;

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/**
 * Parse the model's reply. Tolerates code fences and leading/trailing chatter
 * (common even when told not to), then validates field by field. Returns null
 * when the reply is unusable or the model says there is no decision.
 */
export function parseDecisionReply(raw: string): DecisionDraft | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  let json: Record<string, unknown>;
  try {
    json = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!json || typeof json !== "object" || json.has_decision !== true) return null;

  const title = str(json.title, 200);
  const decision = str(json.decision, 2_000);
  if (!title || !decision) return null;

  const alternatives = (Array.isArray(json.alternatives) ? json.alternatives : [])
    .map((a) => {
      const alt = (a ?? {}) as Record<string, unknown>;
      return { option: str(alt.option, 300), rejected_because: str(alt.rejected_because, 600) };
    })
    .filter((a) => a.option)
    .slice(0, 8);

  return {
    title,
    decision,
    context: str(json.context, 2_000),
    alternatives,
    consequences: str(json.consequences, 2_000),
    revisit_when: str(json.revisit_when, 500),
  };
}

export type ExtractResult =
  | { status: "saved"; id: string; draft: DecisionDraft; model: string }
  | { status: "no-decision" }
  | { status: "no-ai" }
  | { status: "note-not-found" };

/**
 * Extract and upsert the decision record for one note. Must run inside
 * runWithAiConfig so the workspace's BYOK provider is used.
 *
 * `supabase` may be the signed-in user's client (RLS-scoped) or the service
 * role (webhook); the workspace filter on the note read keeps both honest.
 */
export async function extractDecisionForNote(
  supabase: Supabase,
  workspaceId: string,
  noteId: string,
): Promise<ExtractResult> {
  if (!isAiConfigured()) return { status: "no-ai" };

  const { data: note, error } = await supabase
    .from("notes")
    .select("id, title, body_markdown, source_url")
    .eq("id", noteId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!note) return { status: "note-not-found" };

  const row = note as { id: string; title: string; body_markdown: string; source_url?: string | null };
  const text = `# ${row.title}\n\n${row.body_markdown}`.slice(0, DECISION_INPUT_LIMIT);

  const provider = resolveProvider();
  const reply = await provider.chat(
    [
      { role: "system", content: DECISION_SYSTEM_PROMPT },
      { role: "user", content: text },
    ],
    800,
  );

  const draft = parseDecisionReply(reply);
  if (!draft) {
    // A stale record from an earlier extraction would now contradict the note.
    await supabase.from("decision_records").delete().eq("note_id", noteId).eq("workspace_id", workspaceId);
    return { status: "no-decision" };
  }

  const { data: saved, error: saveError } = await supabase
    .from("decision_records")
    .upsert(
      {
        workspace_id: workspaceId,
        note_id: noteId,
        source_url: row.source_url ?? null,
        model: provider.name,
        ...draft,
      },
      { onConflict: "note_id" },
    )
    .select("id")
    .single();
  if (saveError) throw saveError;

  return { status: "saved", id: (saved as { id: string }).id, draft, model: provider.name };
}
