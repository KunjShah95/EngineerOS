import { describe, expect, it } from "vitest";

import { ALL_TOPICS, TRACKS, getTopic } from "@/content/learn";
import { buildGraph, computeDepths, layoutGraph, pathTo, readyToLearn, unlocks } from "./graph";
import { searchTopics, tokenize } from "./search";

describe("content integrity", () => {
  it("has unique ids and valid prerequisites", () => {
    const ids = ALL_TOPICS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of ALL_TOPICS) {
      for (const pre of t.prerequisites) {
        expect(getTopic(pre), `${t.id} -> ${pre}`).toBeDefined();
        expect(pre).not.toBe(t.id);
      }
    }
  });

  it("has no prerequisite cycles", () => {
    expect(() => computeDepths(ALL_TOPICS)).not.toThrow();
  });

  it("every topic is complete and sits in the track that lists it", () => {
    for (const track of TRACKS) {
      for (const t of track.topics) {
        expect(t.track).toBe(track.id);
        expect(t.summary.length).toBeGreaterThan(20);
        expect(t.body.length).toBeGreaterThanOrEqual(2);
        expect(t.keyPoints.length).toBeGreaterThanOrEqual(3);
        expect(t.practice.length).toBeGreaterThanOrEqual(1);
        expect(t.minutes).toBeGreaterThan(0);
      }
    }
  });

  it("detects cycles when they exist", () => {
    const [a, b] = ALL_TOPICS;
    expect(() =>
      computeDepths([
        { ...a, prerequisites: [b.id] },
        { ...b, prerequisites: [a.id] },
      ])
    ).toThrow(/cycle/i);
  });
});

describe("rag course", () => {
  it("is ordered so every prerequisite inside the track comes earlier", () => {
    const track = TRACKS.find((t) => t.id === "rag-engineering")!;
    const order = track.topics.map((t) => t.id);
    expect(track.topics.length).toBeGreaterThanOrEqual(14);
    track.topics.forEach((t, i) => {
      for (const pre of t.prerequisites.filter((p) => order.includes(p))) {
        expect(order.indexOf(pre), `${t.id} after ${pre}`).toBeLessThan(i);
      }
      expect(t.module, t.id).toBeTruthy();
    });
    expect(order.at(-1)).toBe("rag-capstone-build");
  });
});

describe("graph", () => {
  const graph = buildGraph();

  it("marks cross-track edges", () => {
    const edge = graph.edges.find((e) => e.from === "idempotency-and-retries" && e.to === "agent-loop");
    expect(edge?.crossTrack).toBe(true);
  });

  it("path ends at the target and respects ordering", () => {
    const path = pathTo("harness-engineering").map((t) => t.id);
    expect(path.at(-1)).toBe("harness-engineering");
    for (const t of pathTo("harness-engineering")) {
      for (const pre of t.prerequisites) {
        expect(path.indexOf(pre)).toBeLessThan(path.indexOf(t.id));
      }
    }
  });

  it("returns an empty path for unknown ids", () => {
    expect(pathTo("nope")).toEqual([]);
  });

  it("unlocks and readyToLearn agree", () => {
    expect(unlocks("caching").map((t) => t.id)).toContain("rate-limiting");
    const ready = readyToLearn(["requirements-and-estimation"]).map((t) => t.id);
    expect(ready).toContain("data-modeling-and-storage");
    expect(ready).not.toContain("caching");
  });

  it("lays out every node inside the canvas", () => {
    const layout = layoutGraph(graph);
    expect(layout.nodes).toHaveLength(graph.nodes.length);
    for (const n of layout.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.x).toBeLessThan(layout.width);
      expect(n.y).toBeLessThan(layout.height);
    }
  });
});

describe("search", () => {
  it("tokenizes and drops stop words", () => {
    expect(tokenize("How do I scale the database?")).toEqual(["scale", "database"]);
  });

  it("finds topics by concept", () => {
    expect(searchTopics("token bucket")[0]?.id).toBe("rate-limiting");
    expect(searchTopics("prompt injection")[0]?.id).toBe("guardrails-and-prompt-injection");
  });

  it("filters by track and clamps the limit", () => {
    const hits = searchTopics("cache", { track: "ai-engineering", limit: 999 });
    expect(hits.every((h) => h.track === "ai-engineering")).toBe(true);
    expect(hits.length).toBeLessThanOrEqual(25);
  });

  it("finds the RAG course lessons", () => {
    expect(searchTopics("chunking", { track: "rag-engineering" })[0]?.track).toBe("rag-engineering");
    expect(searchTopics("reciprocal rank fusion")[0]?.id).toBe("rag-hybrid-retrieval-and-reranking");
  });

  it("returns nothing for empty queries", () => {
    expect(searchTopics("   ")).toEqual([]);
  });
});
