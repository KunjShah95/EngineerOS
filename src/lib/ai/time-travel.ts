// Time travel — answer questions against the workspace as it existed on a date.
//
// Retrieval today reads live rows: `notes.body_markdown` as it is right now.
// That makes "what did I believe about auth in March?" unanswerable — the March
// text is gone, overwritten by every edit since. But `note_versions` keeps
// append-only snapshots, and the VersionTimeline already diffs them, so the
// historical corpus is mostly a matter of reading the right row.
//
// The subtlety is that notes are only pinned if their history can be
// reconstructed:
//   * note unchanged since the pin  → the live body IS the historical body
//   * note changed, snapshot before the pin exists → use that snapshot
//   * note changed, no snapshot before the pin → cannot be reconstructed
//
// That third case is the whole game: silently answering from today's text for a
// question about March would be a confident lie, so those notes are reported as
// unpinned instead and excluded from the corpus.
//
// Retrieval over the pinned corpus is keyword-based on purpose. Embeddings in
// the `embeddings` table describe the *current* body, so reusing them would
// quietly answer as-of-now. Re-embedding every historical body on each question
// is not affordable; keyword scoring is free, offline, and the snippet-level
// precision this feature needs is a citation the user can read.

import {
  answerWithContext,
  makeSnippet,
  noHistoryMessage,
  type RagAnswer,
  type RagChunk,
} from "./rag";
import { scoreCorpus } from "./keyword";
import { diffStats } from "@/lib/markdown-diff";
import type { ChatSource } from "@/types/database";

type Supabase = NonNullable<Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>>;

/** ISO date (yyyy-mm-dd) the question is pinned to. */
export type AsOfDate = string;

export interface PinnedNote {
  id: string;
  title: string;
  /** The body that was live on the pin date. */
  body: string;
  /** Live body, for the "changed since" delta. Null when the note is gone. */
  currentBody: string | null;
  titleUpdated: boolean;
}

export interface PinnedCorpus {
  pinned: PinnedNote[];
  /**
   * Notes that existed on the pin date but whose body can't be reconstructed.
   * Surfaced in the UI: the user asked about the past and deserves to know
   * which parts of the past are missing.
   */
  unpinned: { title: string }[];
  /** True when nothing at all could be reconstructed (no snapshots that old). */
  empty: boolean;
}

interface NoteRow {
  id: string;
  title: string;
  body_markdown: string;
  updated_at: string;
  created_at: string;
}

interface VersionRow {
  note_id: string;
  title: string;
  body_markdown: string;
  created_at: string;
}

/**
 * Pure selection of one note's historical body.
 *
 * Exported for tests: the "unpinned" branch is the interesting one and the one
 * that must never silently fall back to the live body.
 */
export function pinNote(
  note: NoteRow,
  snapshots: VersionRow[],
  asOfMs: number
): { body: string; title: string; titleUpdated: boolean; fromSnapshot: boolean } | null {
  const liveMs = new Date(note.updated_at).getTime();

  // Untouched since the pin: the live body is the historical body.
  if (liveMs <= asOfMs) {
    return { body: note.body_markdown, title: note.title, titleUpdated: false, fromSnapshot: false };
  }

  // Newest snapshot at or before the pin — versions are ordered desc.
  const prior = snapshots
    .filter((v) => new Date(v.created_at).getTime() <= asOfMs)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];

  if (!prior) return null; // edited before any snapshot existed — unreconstructable
  return { body: prior.body_markdown, title: prior.title, titleUpdated: true, fromSnapshot: true };
}

export async function buildPinnedCorpus(
  supabase: Supabase,
  workspaceId: string,
  asOf: AsOfDate
): Promise<PinnedCorpus> {
  const asOfMs = new Date(`${asOf}T23:59:59Z`).getTime();

  const [notesRes, versionsRes] = await Promise.all([
    supabase
      .from("notes")
      .select("id, title, body_markdown, updated_at, created_at")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null),
    supabase
      .from("note_versions")
      .select("note_id, title, body_markdown, created_at")
      .eq("workspace_id", workspaceId)
      .lte("created_at", new Date(asOfMs).toISOString())
      .order("created_at", { ascending: false }),
  ]);

  const notes = (notesRes.data ?? []) as NoteRow[];
  const versions = (versionsRes.data ?? []) as VersionRow[];

  const byNote = new Map<string, VersionRow[]>();
  for (const v of versions) {
    const list = byNote.get(v.note_id);
    if (list) list.push(v);
    else byNote.set(v.note_id, [v]);
  }

  const pinned: PinnedNote[] = [];
  const unpinned: { title: string }[] = [];

  for (const note of notes) {
    // Born after the pin — it didn't exist yet, so it isn't a gap.
    if (new Date(note.created_at).getTime() > asOfMs) continue;

    const chosen = pinNote(note, byNote.get(note.id) ?? [], asOfMs);
    if (!chosen) {
      unpinned.push({ title: note.title });
      continue;
    }
    pinned.push({
      id: note.id,
      title: chosen.title,
      body: chosen.body,
      currentBody: note.body_markdown,
      titleUpdated: chosen.titleUpdated,
    });
  }

  return { pinned, unpinned, empty: pinned.length === 0 };
}

/** One line describing what changed in a note since the pin ("" when unchanged). */
export function changedSinceSummary(note: PinnedNote): string {
  if (note.currentBody == null) return "deleted since";
  if (note.currentBody === note.body) return "";
  const { added, removed } = diffStats(note.body, note.currentBody);
  if (added === 0 && removed === 0) return "";
  const bits: string[] = [];
  if (added > 0) bits.push(`+${added} line${added === 1 ? "" : "s"}`);
  if (removed > 0) bits.push(`−${removed} line${removed === 1 ? "" : "s"}`);
  return bits.join(" ");
}

export interface TimeTravelRetrieval {
  chunks: RagChunk[];
  unpinned: { title: string }[];
  empty: boolean;
}

/**
 * Rank the pinned corpus against the question and build cited chunks.
 * Sources carry as_of + changed_since so the UI can show both.
 */
export function retrievePinned(
  corpus: PinnedCorpus,
  question: string,
  asOf: AsOfDate,
  topK = 6
): TimeTravelRetrieval {
  if (corpus.empty) return { chunks: [], unpinned: corpus.unpinned, empty: true };

  const ranked = scoreCorpus(
    question,
    corpus.pinned.map((n) => ({ title: n.title, text: n.body }))
  ).slice(0, topK);

  const topIds = new Set(ranked.map((r) => r.item.title));
  const chunks: RagChunk[] = ranked.map(({ item, score }) => {
    const note = corpus.pinned.find((n) => n.title === item.title)!;
    const delta = changedSinceSummary(note);
    const source: ChatSource = {
      entity_type: "note",
      entity_id: note.id,
      title: note.title,
      href: `/notes/${note.id}`,
      score,
      retrieval: "time-travel",
      as_of: asOf,
      snippet: makeSnippet(item.text),
    };
    if (delta) {
      source.changed_since = true;
      source.diff_summary = delta;
    }
    return { content: item.text.slice(0, 1400), source };
  });

  // Only unpinned notes the question actually touched are worth mentioning.
  const touched = corpus.unpinned.filter((u) => topIds.has(u.title));
  return { chunks, unpinned: touched, empty: false };
}

/**
 * Build the plain-text coverage warning for a time-travel answer, and the
 * trailing honesty note. Kept separate from the LLM prompt so it is never
 * paraphrased away into a claim of certainty.
 */
export function coverageNote(unpinned: { title: string }[]): string {
  if (unpinned.length === 0) return "";
  const titles = unpinned.slice(0, 3).map((u) => `“${u.title}”`).join(", ");
  const more = unpinned.length > 3 ? ` and ${unpinned.length - 3} more` : "";
  return `\n\n_Not covered: ${titles}${more} changed after that date with no earlier snapshot, so they're excluded._`;
}

export interface TimeTravelAnswer extends RagAnswer {
  as_of: AsOfDate;
  /** Notes excluded because their history couldn't be reconstructed. */
  unpinned: { title: string }[];
  /** True when the answer came from an empty (or nonexistent) history. */
  empty: boolean;
}

/**
 * Answer a question as of `asOf`. Runs inside runWithAiConfig by the caller, so
 * answerWithContext picks up the request-scoped provider/key.
 */
export async function answerTimeTravel(
  supabase: Supabase,
  workspaceId: string,
  question: string,
  asOf: AsOfDate,
  history: { role: "user" | "assistant"; content: string }[]
): Promise<TimeTravelAnswer> {
  const corpus = await buildPinnedCorpus(supabase, workspaceId, asOf);
  const { chunks, unpinned, empty } = retrievePinned(corpus, question, asOf);

  if (empty) {
    return {
      answer: noHistoryMessage(asOf),
      model: "local-time-travel",
      local: true,
      sources: [],
      strategy: "keyword",
      as_of: asOf,
      unpinned: corpus.unpinned,
      empty: true,
    };
  }

  const result = await answerWithContext(question, chunks, history);
  return {
    ...result,
    // Appended after generation, never handed to the model to paraphrase, so
    // missing history can't be smoothed into a claim of full coverage.
    answer: `${result.answer}${coverageNote(unpinned)}`,
    as_of: asOf,
    unpinned,
    empty: false,
  };
}
