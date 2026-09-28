// Helpers for surfacing past decisions and capturing new ones from chats.
// Pure functions only — routes do the I/O.

/** Words that carry no topic signal for matching a task title to decisions. */
const STOPWORDS = new Set([
  "about", "after", "again", "also", "because", "before", "being", "between", "build", "could",
  "does", "doing", "done", "each", "fix", "from", "have", "into", "just", "make", "more", "need",
  "should", "some", "than", "that", "their", "them", "then", "there", "these", "they", "this",
  "todo", "update", "using", "want", "what", "when", "which", "while", "will", "with", "would",
  "your", "add", "new", "use",
]);

/**
 * Topic terms for the keyword fallback (used when embeddings aren't set up).
 * Restricted to [a-z0-9] so terms are safe to splice into a PostgREST `or`
 * filter — commas, dots and parens there are filter syntax.
 */
export function topicTerms(text: string, max = 6): string[] {
  const words = text.toLowerCase().match(/[a-z0-9]{4,}/g) ?? [];
  const seen = new Set<string>();
  for (const w of words) {
    if (!STOPWORDS.has(w)) seen.add(w);
    if (seen.size >= max) break;
  }
  return [...seen];
}

export interface Rankable {
  id: string;
  title: string;
  decision: string;
  context: string;
}

/**
 * Order candidates by how many distinct terms they mention. With two or more
 * terms, a single shared word is usually coincidence ("queue" in an unrelated
 * decision), so require two hits before showing anything.
 */
export function rankByTermHits<T extends Rankable>(candidates: T[], terms: string[], limit = 3): T[] {
  if (terms.length === 0) return [];
  const minHits = terms.length >= 2 ? 2 : 1;
  return candidates
    .map((c) => {
      const haystack = `${c.title} ${c.decision} ${c.context}`.toLowerCase();
      return { c, hits: terms.filter((t) => haystack.includes(t)).length };
    })
    .filter((x) => x.hits >= minHits)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, limit)
    .map((x) => x.c);
}

/** Pasted conversations shorter than this can't hold a decision worth saving. */
export const CHAT_MIN_CHARS = 40;
/** Long enough for a real design thread; beyond this it's a log dump. */
export const CHAT_MAX_CHARS = 60_000;

/** Note body for a pasted conversation: provenance line, then the transcript verbatim. */
export function chatCaptureNote(text: string, source: string, now = new Date()) {
  const date = now.toISOString().slice(0, 10);
  const from = source.trim() ? ` from ${source.trim().slice(0, 60)}` : "";
  return {
    title: `Chat capture${from} — ${date}`,
    body_markdown: `> Captured from a pasted conversation${from} on ${date}.\n\n## Conversation\n\n${text.trim()}`,
  };
}
