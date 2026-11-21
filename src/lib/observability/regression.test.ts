import { describe, expect, it } from "vitest";
import { evaluate } from "@/lib/ai/eval/retrieval-eval";
import baseline from "@/lib/ai/eval/baseline.json";

describe("retrieval regression (CI)", () => {
  for (const strategy of ["keyword", "hybrid-weighted", "graph"] as const) {
    it(`${strategy} does not regress vs baseline`, () => {
      const r = evaluate(strategy);
      const b = (baseline as unknown as Record<string, { recallAt5: number }>)[strategy];
      expect(r.recallAt5).toBeGreaterThanOrEqual(b.recallAt5 - 0.01);
      expect(r.mrr).toBeGreaterThanOrEqual(b.mrr - 0.01);
      expect(r.citationSupport).toBeGreaterThanOrEqual(b.citationSupport - 0.01);
    });
  }
});