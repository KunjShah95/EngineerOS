/**
 * Retrieval evaluation: recall@k and MRR over a fixed corpus.
 *
 * Runs against the pure ranking functions with no database and no API key, so
 * it executes in CI and gives a comparable number on every commit. It measures
 * ranking quality, not embedding quality — the semantic leg here is the local
 * fingerprint embedder, which is deliberately weak. That makes the fusion
 * numbers a floor rather than a ceiling: real provider embeddings can only
 * move the semantic leg up.
 */

import { scoreCorpus } from "@/lib/ai/keyword";
import { reciprocalRankFusion } from "@/lib/ai/fusion";
import { EVAL_DOCS, EVAL_QUERIES, type EvalDoc, type EvalQuery } from "./fixtures";

export type Strategy = "keyword" | "semantic" | "hybrid" | "hybrid-weighted";

/**
 * Weight on the semantic leg when fusing. Tuned against this eval: the local
 * fingerprint embedder is lexical and weak, so an equal-weight fusion drags
 * keyword ranking down. See docs/adr/0001-retrieval.md.
 */
export const SEMANTIC_WEIGHT = 0.35;

interface Ranked {
  key: string;
  doc: EvalDoc;
}

/* ---------- retrieval legs ---------- */

function keywordRank(query: string, docs: EvalDoc[]): Ranked[] {
  return scoreCorpus(query, docs.map((d) => ({ ...d, title: d.title, text: d.text })))
    .map(({ item }) => ({ key: (item as EvalDoc).id, doc: item as EvalDoc }));
}

/** Cosine similarity over a deterministic bag-of-words fingerprint. */
function fingerprint(text: string, dim = 512): Float64Array {
  const vec = new Float64Array(dim);
  const words = text.toLowerCase().match(/[a-z0-9_]{3,}/g) ?? [];
  for (const w of words) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < w.length; i++) {
      h ^= w.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    vec[Math.abs(h) % dim] += 1;
  }
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i++) vec[i] /= norm;
  return vec;
}

function cosine(a: Float64Array, b: Float64Array): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

function semanticRank(query: string, docs: EvalDoc[]): Ranked[] {
  const q = fingerprint(query);
  return docs
    .map((doc) => ({ doc, score: cosine(q, fingerprint(`${doc.title} ${doc.text}`)) }))
    .sort((a, b) => b.score - a.score)
    .map(({ doc }) => ({ key: doc.id, doc }));
}

function hybridRank(query: string, docs: EvalDoc[], semanticWeight = 1): Ranked[] {
  return reciprocalRankFusion<Ranked>({
    keyword: { results: keywordRank(query, docs), weight: 1 },
    semantic: { results: semanticRank(query, docs), weight: semanticWeight },
  }).map((r) => r.item);
}

export function retrieve(strategy: Strategy, query: string, docs: EvalDoc[] = EVAL_DOCS): Ranked[] {
  if (strategy === "keyword") return keywordRank(query, docs);
  if (strategy === "semantic") return semanticRank(query, docs);
  if (strategy === "hybrid-weighted") return hybridRank(query, docs, SEMANTIC_WEIGHT);
  return hybridRank(query, docs);
}

/* ---------- metrics ---------- */

export interface EvalReport {
  strategy: Strategy;
  n: number;
  recallAt1: number;
  recallAt3: number;
  recallAt5: number;
  mrr: number;
  /** Questions where no relevant doc appeared in the top 5. */
  misses: string[];
  byKind: Record<EvalQuery["kind"], { n: number; recallAt3: number }>;
}

function recallAt(ranked: Ranked[], relevant: string[], k: number): number {
  const top = ranked.slice(0, k).map((r) => r.key);
  const hits = relevant.filter((id) => top.includes(id)).length;
  return relevant.length === 0 ? 0 : hits / relevant.length;
}

function reciprocalRank(ranked: Ranked[], relevant: string[]): number {
  const index = ranked.findIndex((r) => relevant.includes(r.key));
  return index === -1 ? 0 : 1 / (index + 1);
}

export function evaluate(
  strategy: Strategy,
  queries: EvalQuery[] = EVAL_QUERIES,
  docs: EvalDoc[] = EVAL_DOCS
): EvalReport {
  const kinds: EvalQuery["kind"][] = ["paraphrase", "exact", "mixed"];
  const byKind = Object.fromEntries(
    kinds.map((k) => [k, { n: 0, recallAt3: 0 }])
  ) as EvalReport["byKind"];

  let r1 = 0;
  let r3 = 0;
  let r5 = 0;
  let mrr = 0;
  const misses: string[] = [];

  for (const query of queries) {
    const ranked = retrieve(strategy, query.question, docs);
    const at3 = recallAt(ranked, query.relevant, 3);

    r1 += recallAt(ranked, query.relevant, 1);
    r3 += at3;
    r5 += recallAt(ranked, query.relevant, 5);
    mrr += reciprocalRank(ranked, query.relevant);

    byKind[query.kind].n += 1;
    byKind[query.kind].recallAt3 += at3;

    if (recallAt(ranked, query.relevant, 5) === 0) misses.push(query.question);
  }

  const n = queries.length;
  for (const k of kinds) {
    byKind[k].recallAt3 = byKind[k].n ? byKind[k].recallAt3 / byKind[k].n : 0;
  }

  return {
    strategy,
    n,
    recallAt1: r1 / n,
    recallAt3: r3 / n,
    recallAt5: r5 / n,
    mrr: mrr / n,
    misses,
    byKind,
  };
}

/** Human-readable comparison across all three strategies. */
export function compareStrategies(): string {
  const reports = (["keyword", "semantic", "hybrid", "hybrid-weighted"] as Strategy[]).map((s) =>
    evaluate(s)
  );
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`.padStart(7);

  const lines = [
    `Retrieval eval — ${reports[0].n} queries, ${EVAL_DOCS.length} docs`,
    "",
    "strategy          recall@1 recall@3 recall@5     MRR",
    "--------------------------------------------------",
    ...reports.map(
      (r) =>
        `${r.strategy.padEnd(16)} ${pct(r.recallAt1)} ${pct(r.recallAt3)} ${pct(r.recallAt5)} ${pct(r.mrr)}`
    ),
    "",
    "recall@3 by question type",
    "--------------------------------------------------",
    ...reports.map(
      (r) =>
        `${r.strategy.padEnd(16)} paraphrase ${pct(r.byKind.paraphrase.recallAt3)}  exact ${pct(
          r.byKind.exact.recallAt3
        )}  mixed ${pct(r.byKind.mixed.recallAt3)}`
    ),
  ];

  return lines.join("\n");
}
