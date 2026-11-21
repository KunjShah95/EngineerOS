/**
 * Optional reranking of retrieved chunks (improvement A).
 *
 * Retrieval returns plausible but sometimes irrelevant chunks. A reranker
 * re-scores the candidate set against the query using a stronger signal than
 * the first-stage retriever (lexical overlap, cross-encoder, or LLM judge).
 *
 * The default implementation is deterministic and dependency-free so it runs
 * in CI. Provider-backed rerankers (Cohere, etc.) can be plugged in via
 * `rerankWithProvider`.
 */

export interface RerankCandidate {
  id: string;
  text: string;
  /** First-stage score, if any. */
  score?: number;
  /** Arbitrary payload carried through. */
  payload?: unknown;
}

export interface Reranked<T = RerankCandidate> {
  item: T;
  score: number;
  rank: number;
}

/** Tokenize for overlap scoring (reuses keyword tokenizer semantics). */
function tokens(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).filter(Boolean);
}

/**
 * Deterministic lexical-overlap reranker. Scores each candidate by the
 * fraction of query tokens it contains (with a small title/position boost
 * from the first-stage score). Stable and dependency-free.
 */
export function rerankByOverlap(
  query: string,
  candidates: RerankCandidate[],
  topK = candidates.length
): Reranked<RerankCandidate>[] {
  const qTokens = new Set(tokens(query));
  if (qTokens.size === 0) {
    return candidates.slice(0, topK).map((c, i) => ({ item: c, score: c.score ?? 0, rank: i }));
  }
  const scored = candidates.map((c) => {
    const cTokens = tokens(c.text);
    const cSet = new Set(cTokens);
    let overlap = 0;
    for (const t of qTokens) if (cSet.has(t)) overlap += 1;
    const coverage = overlap / qTokens.size;
    const firstStage = typeof c.score === "number" ? c.score : 0;
    const score = coverage * 0.8 + firstStage * 0.2;
    return { item: c, score };
  });
  scored.sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id));
  return scored.slice(0, topK).map((s, i) => ({ ...s, rank: i }));
}

/**
 * Generic rerank entry point. If a provider function is supplied it is used;
 * otherwise falls back to the deterministic overlap reranker. Failures fall
 * back to the input order (never throws).
 */
export async function rerank(
  query: string,
  candidates: RerankCandidate[],
  options: { topK?: number; provider?: (q: string, c: RerankCandidate[]) => Promise<number[]> } = {}
): Promise<Reranked<RerankCandidate>[]> {
  const topK = options.topK ?? candidates.length;
  if (options.provider) {
    try {
      const scores = await options.provider(query, candidates);
      const scored = candidates.map((c, i) => ({ item: c, score: scores[i] ?? 0 }));
      scored.sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id));
      return scored.slice(0, topK).map((s, i) => ({ ...s, rank: i }));
    } catch {
      // fall through to deterministic
    }
  }
  return rerankByOverlap(query, candidates, topK);
}

/** Convenience: rerank chunks shaped as { id, text, score }. */
export function rerankChunks(
  query: string,
  chunks: { id: string; text: string; score?: number }[],
  topK?: number
): Reranked<RerankCandidate>[] {
  return rerankByOverlap(
    query,
    chunks.map((c) => ({ id: c.id, text: c.text, score: c.score })),
    topK
  );
}

/** Explicit "not enough evidence" response helper (improvement A). */
export function notEnoughEvidence(question: string, retrievedCount = 0): string {
  return (
    `I couldn't find enough evidence in your workspace to answer: "${question}". ` +
    (retrievedCount > 0
      ? `I retrieved ${retrievedCount} possibly-related chunk(s), but none were relevant enough to cite. `
      : "") +
    "Try rephrasing, or add a note capturing this decision first."
  );
}
