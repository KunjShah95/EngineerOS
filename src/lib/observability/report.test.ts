import { describe, expect, it } from "vitest";
import { createTrace, finishTrace, recordModel, recordRetrieval } from "@/lib/ai/trace";
import { aggregateTraces, detectRegression } from "./report";

describe("observability", () => {
  it("aggregates traces", () => {
    const t1 = createTrace("q1");
    recordRetrieval(t1, { strategy: "k", k: 5, docIds: ["a", "b"] });
    recordModel(t1, { provider: "openai", model: "m", totalTokens: 50, costUsd: 0.002 });
    finishTrace(t1);
    const agg = aggregateTraces([t1]);
    expect(agg.n).toBe(1);
    expect(agg.totalTokens).toBe(50);
    expect(agg.avgRetrievalDocs).toBe(2);
  });

  it("detects regression", () => {
    const base = aggregateTraces([]);
    // craft baseline with values by constructing aggregate manually via traces
    const t = createTrace("q");
    recordModel(t, { provider: "p", model: "m", totalTokens: 10, costUsd: 0.001, refused: false });
    finishTrace(t);
    const curAgg = aggregateTraces([t]);
    // baseline refused rate high to trigger? Instead test latency regression
    const baseline = { ...curAgg, avgLatencyMs: 1 };
    const current = { ...curAgg, avgLatencyMs: 10 };
    const r = detectRegression(baseline as unknown as Parameters<typeof detectRegression>[0], current as unknown as Parameters<typeof detectRegression>[1], { maxLatencyIncreasePct: 0.2 });
    expect(r.regressed).toBe(true);
    expect(r.reasons.length).toBeGreaterThan(0);
  });
});