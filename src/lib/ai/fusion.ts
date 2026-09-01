/**
 * Reciprocal rank fusion for hybrid retrieval.
 *
 * Semantic and keyword search each fail in a way the other covers. Embeddings
 * miss exact tokens — error codes, function names, ticket ids — and return
 * things that are merely thematically close. Keyword search misses paraphrase:
 * "how do users log in" never matches a note titled "JWT refresh flow".
 *
 * Running both and merging fixes both failure modes, but their scores are not
 * comparable — a cosine similarity of 0.82 and a keyword score of 4.7 are
 * different units. RRF sidesteps this by scoring on *rank position* instead of
 * raw score:
 *
 *     score(d) = Σ  weight_list / (K + rank_of_d_in_list)
 *
 * K damps the influence of top ranks so a single list cannot dominate; 60 is
 * the value from the original TREC work and behaves well here.
 */

export const RRF_K = 60;

export interface FusionCandidate {
  /** Stable identity across lists. Same key = same document. */
  key: string;
}

export interface FusionInput<T extends FusionCandidate> {
  results: T[];
  /** Relative trust in this list. Defaults to 1. */
  weight?: number;
}

export interface FusedResult<T extends FusionCandidate> {
  item: T;
  score: number;
  /** 0-based rank in each contributing list, for debugging and evals. */
  ranks: Record<string, number>;
}

/**
 * Fuse any number of ranked lists into one.
 *
 * Lists are passed as a record so the contributing rank of each source stays
 * labelled on the way out — which is what makes a bad ranking debuggable
 * rather than mysterious.
 */
export function reciprocalRankFusion<T extends FusionCandidate>(
  lists: Record<string, FusionInput<T>>,
  k: number = RRF_K
): FusedResult<T>[] {
  const accumulator = new Map<string, FusedResult<T>>();

  for (const [listName, { results, weight = 1 }] of Object.entries(lists)) {
    results.forEach((item, index) => {
      const existing = accumulator.get(item.key);
      const contribution = weight / (k + index + 1);

      if (existing) {
        existing.score += contribution;
        existing.ranks[listName] = index;
      } else {
        accumulator.set(item.key, {
          item,
          score: contribution,
          ranks: { [listName]: index },
        });
      }
    });
  }

  return Array.from(accumulator.values()).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Deterministic tiebreak so evals and snapshots are stable.
    return a.item.key.localeCompare(b.item.key);
  });
}
