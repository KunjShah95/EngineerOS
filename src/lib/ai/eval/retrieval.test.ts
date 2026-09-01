/**
 * Retrieval quality regression tests.
 *
 * These assert floors and relative orderings that held when measured, so a
 * change to chunking, scoring, or fusion that degrades retrieval fails CI
 * instead of shipping.
 *
 * Measured baseline (20 queries, 22 docs, local fingerprint semantic leg):
 *
 *   strategy          recall@1 recall@3 recall@5     MRR
 *   keyword             82.5%   100.0%   100.0%   92.5%
 *   semantic            52.5%    85.0%    95.0%   72.2%
 *   hybrid (1.0)        72.5%    97.5%   100.0%   86.7%
 *   hybrid (0.35)       82.5%   100.0%   100.0%   92.5%
 *
 * Read that honestly: equal-weight fusion is *worse* than keyword alone here,
 * and down-weighting the semantic leg only recovers parity. That is not a
 * verdict on hybrid retrieval — it is a verdict on this eval's semantic leg,
 * which is a bag-of-words fingerprint standing in for a real embedding model.
 * A lexical ranker fused with another lexical ranker adds no independent
 * signal, only noise. See docs/adr/0001-retrieval.md.
 */

import { describe, expect, it } from "vitest";

import { compareStrategies, evaluate } from "./retrieval-eval";
import { EVAL_DOCS, EVAL_QUERIES } from "./fixtures";

describe("eval corpus", () => {
  it("covers a meaningful number of queries across all three question types", () => {
    expect(EVAL_QUERIES.length).toBeGreaterThanOrEqual(20);
    for (const kind of ["paraphrase", "exact", "mixed"] as const) {
      expect(EVAL_QUERIES.filter((q) => q.kind === kind).length).toBeGreaterThanOrEqual(5);
    }
  });

  it("carries enough distractors to stay discriminative", () => {
    // With too small a corpus every strategy scores 100% and the eval is
    // decorative. The semantic/keyword gap below is the evidence it is not.
    expect(EVAL_DOCS.length).toBeGreaterThanOrEqual(20);
    expect(evaluate("keyword").mrr - evaluate("semantic").mrr).toBeGreaterThan(0.1);
  });

  it("references only real doc ids", () => {
    const ids = new Set(EVAL_DOCS.map((d) => d.id));
    for (const q of EVAL_QUERIES) {
      for (const id of q.relevant) expect(ids.has(id), `${q.question} → ${id}`).toBe(true);
    }
  });
});

describe("retrieval quality floors", () => {
  it("keyword retrieval holds its measured baseline", () => {
    const r = evaluate("keyword");
    expect(r.recallAt3).toBeGreaterThanOrEqual(0.95);
    expect(r.mrr).toBeGreaterThanOrEqual(0.9);
  });

  it("weighted fusion does not regress below keyword alone", () => {
    // The bar fusion must clear to stay in the pipeline: it may not make
    // ranking worse than the leg it is fusing with.
    const keyword = evaluate("keyword");
    const hybrid = evaluate("hybrid-weighted");
    expect(hybrid.mrr).toBeGreaterThanOrEqual(keyword.mrr - 0.001);
    expect(hybrid.recallAt3).toBeGreaterThanOrEqual(keyword.recallAt3 - 0.001);
  });

  it("fusion improves on the semantic leg alone", () => {
    // Fusion is doing *something* — it rescues the weaker ranker.
    expect(evaluate("hybrid").mrr).toBeGreaterThan(evaluate("semantic").mrr);
  });

  it("down-weighting the semantic leg beats equal-weight fusion", () => {
    // Documents why SEMANTIC_WEIGHT is not 1.0. If a future embedding model
    // makes this assertion fail, that is the signal to raise the weight.
    expect(evaluate("hybrid-weighted").mrr).toBeGreaterThan(evaluate("hybrid").mrr);
  });

  it("finds every answer within the top 5", () => {
    expect(evaluate("hybrid-weighted").misses).toEqual([]);
  });
});

describe("report", () => {
  it("prints the comparison table", () => {
    const table = compareStrategies();
    expect(table).toContain("hybrid-weighted");
    console.log("\n" + table + "\n");
  });
});
