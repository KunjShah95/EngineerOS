import { describe, expect, it } from "vitest";
import {
  createTrace,
  finishTrace,
  recordModel,
  recordRetrieval,
  recordTool,
  traceSummary,
} from "./trace";

describe("trace", () => {
  it("captures retrieval/model/tool spans and summarizes", () => {
    const t = createTrace("how do users sign in");
    recordRetrieval(t, { strategy: "hybrid", k: 5, docIds: ["a", "b"] });
    const tool = recordTool(t, "create_task", { title: "x" }, { id: 1 }, true, 12);
    recordModel(t, { provider: "openai", model: "gpt-4o-mini", totalTokens: 100, costUsd: 0.001 });
    recordTool(t, "bad_tool", {}, null, false);
    finishTrace(t);

    expect(t.spans.length).toBe(4);
    const s = traceSummary(t);
    expect(s.retrievalDocs).toBe(2);
    expect(s.toolCalls).toBe(2);
    expect(s.toolFailures).toBe(1);
    expect(s.totalTokens).toBe(100);
    expect(s.costUsd).toBeCloseTo(0.001);
    expect(s.durationMs).toBeGreaterThanOrEqual(0);
    expect(tool.attributes.ok).toBe(true);
  });

  it("records refused model", () => {
    const t = createTrace("unknown");
    recordModel(t, { provider: "local", model: "extractive", refused: true });
    finishTrace(t);
    expect(traceSummary(t).refused).toBe(true);
  });
});