/**
 * Evaluation & observability aggregation (plan §5).
 *
 * Aggregates traces into quality/latency/cost summaries, compares versions of
 * prompts/models/retrieval settings, and flags regressions against a baseline.
 */

import type { Span, Trace } from "@/lib/ai/trace";

export interface VersionKey {
  prompt: string;
  model: string;
  retrieval: string;
}

export interface TraceAggregate {
  n: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  totalTokens: number;
  totalCostUsd: number;
  avgCostUsd: number;
  refusedRate: number;
  toolFailureRate: number;
  avgRetrievalDocs: number;
}

export function aggregateTraces(traces: Trace[]): TraceAggregate {
  if (traces.length === 0) {
    return {
      n: 0,
      avgLatencyMs: 0,
      p95LatencyMs: 0,
      totalTokens: 0,
      totalCostUsd: 0,
      avgCostUsd: 0,
      refusedRate: 0,
      toolFailureRate: 0,
      avgRetrievalDocs: 0,
    };
  }
  const latencies = traces.map((t) => t.durationMs ?? 0).sort((a, b) => a - b);
  const p95Index = Math.min(latencies.length - 1, Math.ceil(latencies.length * 0.95) - 1);
  let totalTokens = 0;
  let totalCost = 0;
  let refused = 0;
  let toolCalls = 0;
  let toolFailures = 0;
  let retrievalDocs = 0;
  for (const t of traces) {
    // reuse traceSummary logic inline to avoid circular import
    const walk = (spans: Span[]) => {
      for (const s of spans) {
        const a = s.attributes as Record<string, unknown>;
        if (s.kind === "retrieval") retrievalDocs += Array.isArray(a.docIds) ? a.docIds.length : 0;
        if (s.kind === "tool") {
          toolCalls += 1;
          if (a.ok === false) toolFailures += 1;
        }
        if (s.kind === "model") {
          totalTokens += Number(a.totalTokens ?? 0);
          totalCost += Number(a.costUsd ?? 0);
          if (a.refused === true) refused += 1;
        }
        walk(s.children ?? []);
      }
    };
    walk(t.spans);
  }
  return {
    n: traces.length,
    avgLatencyMs: latencies.reduce((a, b) => a + b, 0) / latencies.length,
    p95LatencyMs: latencies[p95Index],
    totalTokens,
    totalCostUsd: totalCost,
    avgCostUsd: totalCost / traces.length,
    refusedRate: refused / traces.length,
    toolFailureRate: toolCalls ? toolFailures / toolCalls : 0,
    avgRetrievalDocs: retrievalDocs / traces.length,
  };
}

export interface VersionComparison {
  key: VersionKey;
  aggregate: TraceAggregate;
}

export function compareVersions(versions: VersionComparison[]): VersionComparison[] {
  return [...versions].sort((a, b) => b.aggregate.refusedRate - a.aggregate.refusedRate || 0);
}

export interface RegressionThresholds {
  maxRefusedRateIncrease?: number; // e.g. 0.05
  maxLatencyIncreasePct?: number; // e.g. 0.2
  maxCostIncreasePct?: number;
  minRecallAt5?: number;
}

export interface RegressionResult {
  regressed: boolean;
  reasons: string[];
}

export function detectRegression(
  baseline: TraceAggregate,
  current: TraceAggregate,
  thresholds: RegressionThresholds = {}
): RegressionResult {
  const reasons: string[] = [];
  const maxRefused = thresholds.maxRefusedRateIncrease ?? 0.05;
  if (current.refusedRate - baseline.refusedRate > maxRefused) {
    reasons.push(
      `refused rate increased ${(current.refusedRate - baseline.refusedRate).toFixed(3)} > ${maxRefused}`
    );
  }
  const maxLat = thresholds.maxLatencyIncreasePct ?? 0.2;
  if (baseline.avgLatencyMs > 0) {
    const pct = (current.avgLatencyMs - baseline.avgLatencyMs) / baseline.avgLatencyMs;
    if (pct > maxLat) reasons.push(`avg latency increased ${(pct * 100).toFixed(1)}% > ${maxLat * 100}%`);
  }
  const maxCost = thresholds.maxCostIncreasePct ?? 0.2;
  if (baseline.avgCostUsd > 0) {
    const pct = (current.avgCostUsd - baseline.avgCostUsd) / baseline.avgCostUsd;
    if (pct > maxCost) reasons.push(`avg cost increased ${(pct * 100).toFixed(1)}% > ${maxCost * 100}%`);
  }
  return { regressed: reasons.length > 0, reasons };
}

/** CI-friendly: returns exit-code-style boolean. */
export function shouldFailCi(result: RegressionResult): boolean {
  return result.regressed;
}