import { NextResponse } from "next/server";

import { compareStrategies, evaluate } from "@/lib/ai/eval/retrieval-eval";

export async function GET() {
  const strategies = ["keyword", "semantic", "hybrid", "hybrid-weighted", "graph"] as const;
  const reports = strategies.map((s) => evaluate(s));
  return NextResponse.json({
    table: compareStrategies(),
    reports: reports.map((r) => ({
      strategy: r.strategy,
      n: r.n,
      recallAt1: r.recallAt1,
      recallAt3: r.recallAt3,
      recallAt5: r.recallAt5,
      mrr: r.mrr,
      citationPrecisionAt5: r.citationPrecisionAt5,
      citationSupport: r.citationSupport,
      misses: r.misses,
    })),
  });
}