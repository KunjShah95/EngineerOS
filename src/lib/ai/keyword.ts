// Isomorphic keyword retrieval — the no-API-key fallback shared by semantic
// search (client), the RAG assistant (server) and PDF chat (server). Pure
// string math, no Node APIs, so the client can import it directly.
//
// The previous fallback only counted exact 3+ char token matches, so natural
// phrasing ("what did I decide about auth?") scored 0 against a note titled
// "JWT decision". This module adds stem/prefix/substring matching, title
// boosting, and a coverage-weighted score so the local mode actually finds
// things.

/** Function words and auxiliaries that carry no retrieval signal. */
const STOPWORDS = new Set([
  "a", "about", "an", "and", "are", "as", "at", "be", "been", "being", "but", "by",
  "can", "could", "did", "do", "does", "doing", "for", "from", "had", "has",
  "have", "having", "how", "i", "if", "in", "into", "is", "it", "its", "may",
  "might", "must", "not", "of", "on", "or", "shall", "should", "so", "than",
  "that", "the", "their", "them", "there", "these", "they", "this", "those",
  "to", "upon", "was", "we", "were", "what", "when", "where", "whether",
  "which", "while", "who", "whom", "why", "will", "with", "without", "would",
  "you", "your", "me", "us", "him", "her", "then", "here", "there",
]);

/** Lowercase alphanumeric tokens of length >= 2, function words removed. */
export function tokenize(text: string): string[] {
  const raw = text.toLowerCase().match(/[a-z0-9]{2,}/g) ?? [];
  return raw.filter((t) => !STOPWORDS.has(t));
}

/**
 * Loose token match used by retrieval:
 * - exact, e.g. jwt ~ jwt
 * - query is a substring of a longer corpus token (auth inside oauth)
 * - query is a prefix/stem of a corpus token (auth ~ authentication)
 * - corpus token is a prefix/stem of the query (refreshing ~ refresh)
 */
export function tokensMatch(q: string, c: string): boolean {
  if (q === c) return true;
  if (q.length >= 4 && c.includes(q)) return true;
  if (q.length >= 3 && c.startsWith(q)) return true;
  if (q.length >= 3 && c.length >= 4 && q.startsWith(c)) return true;
  return false;
}

export interface KeywordScore {
  /** Weighted [0, ~1.3]; 0 means nothing matched. */
  score: number;
  /** Fraction of query tokens matched somewhere in title/body. */
  coverage: number;
  /** Distinct query tokens found in the title. */
  titleHits: number;
  /** Total query-token hits across title (x2) and body (capped per token). */
  hits: number;
}

export function keywordScore(query: string, title: string, body: string): KeywordScore {
  const q = tokenize(query);
  if (q.length === 0) return { score: 0, coverage: 0, titleHits: 0, hits: 0 };

  const titleTokens = tokenize(title);
  const bodyTokens = tokenize(body);

  let covered = 0;
  let titleHits = 0;
  let hits = 0;

  for (const term of q) {
    let inTitle = false;
    let bodyCount = 0;
    for (const t of titleTokens) {
      if (tokensMatch(term, t)) {
        inTitle = true;
        break;
      }
    }
    for (const t of bodyTokens) {
      if (tokensMatch(term, t)) bodyCount += 1;
    }
    if (inTitle || bodyCount > 0) covered += 1;
    if (inTitle) titleHits += 1;
    hits += (inTitle ? 2 : 0) + Math.min(3, bodyCount);
  }

  const coverage = covered / q.length;
  const density = Math.min(1, hits / (2 * q.length));
  const titleScore = titleHits / q.length;

  return {
    score: coverage * 0.55 + density * 0.25 + titleScore * 0.2,
    coverage,
    titleHits,
    hits,
  };
}

export interface ScoredItem<T> {
  item: T;
  score: number;
  coverage: number;
  titleHits: number;
  hits: number;
}

/** Score a corpus of { title, text } items against a query, ranked desc, zeros dropped. */
export function scoreCorpus<T extends { title: string; text: string }>(
  query: string,
  items: T[]
): ScoredItem<T>[] {
  return items
    .map((item) => ({ item, ...keywordScore(query, item.title, item.text) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.hits - b.hits);
}

/** Split text into trimmed sentences (keeps sentences >= minLen chars). */
export function extractSentences(text: string, minLen = 20): string[] {
  const matches = text.match(/[^.!?\n]+[.!?]*(?:\s+|$)/g) ?? [];
  return matches.map((s) => s.trim()).filter((s) => s.length >= minLen);
}

/**
 * Build a cited extractive answer from the retrieved chunks: score sentences
 * by how many query tokens they cover (earlier chunks weigh more), return the
 * best few in document order. Empty string when nothing meaningful matched.
 */
export function extractiveAnswer(
  query: string,
  chunks: { content: string }[],
  maxSentences = 4,
  maxChars = 1400
): string {
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return "";

  const candidates: { text: string; score: number; order: number }[] = [];
  let order = 0;
  for (let ci = 0; ci < chunks.length; ci++) {
    const chunkWeight = 1 / (1 + ci * 0.4);
    for (const sentence of extractSentences(chunks[ci].content)) {
      const sTokens = tokenize(sentence);
      const matched = new Set<string>();
      for (const t of sTokens) {
        for (const q of qTokens) {
          if (tokensMatch(q, t)) matched.add(q);
        }
      }
      if (matched.size > 0) {
        candidates.push({
          text: sentence,
          score: (matched.size / Math.max(1, qTokens.length)) * chunkWeight,
          order: order++,
        });
      }
    }
  }

  if (candidates.length === 0) return "";

  candidates.sort((a, b) => b.score - a.score || a.order - b.order);
  const picked = candidates.slice(0, maxSentences).sort((a, b) => a.order - b.order);

  let out = "";
  for (const c of picked) {
    if (out.length + c.text.length > maxChars) break;
    out += (out ? " " : "") + c.text;
  }
  return out.trim();
}

/** Human-readable list of what the query was reduced to, for error messages. */
export function searchedTerms(query: string): string {
  const terms = tokenize(query);
  return terms.length > 0 ? terms.join(", ") : "your exact words";
}
