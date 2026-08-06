import { describe, expect, it } from "vitest";

import { wouldCreateDependencyCycle, type DependencyEdge } from "./task-dependencies";

function edges(pairs: [string, string][]): DependencyEdge[] {
  return pairs.map(([task_id, depends_on_task_id]) => ({ task_id, depends_on_task_id }));
}

describe("wouldCreateDependencyCycle", () => {
  it("returns false for a plain new edge", () => {
    // a → b; adding a → c is fine.
    expect(wouldCreateDependencyCycle(edges([["a", "b"]]), "a", "c")).toBe(false);
  });

  it("detects a direct cycle", () => {
    // a → b; adding b → a closes the loop.
    expect(wouldCreateDependencyCycle(edges([["a", "b"]]), "b", "a")).toBe(true);
  });

  it("detects a transitive cycle", () => {
    // a → b → c; adding c → a loops (c → a → b → c).
    const graph = edges([
      ["a", "b"],
      ["b", "c"],
    ]);
    expect(wouldCreateDependencyCycle(graph, "c", "a")).toBe(true);
    // a → c is safe: no path c → a exists.
    expect(wouldCreateDependencyCycle(graph, "a", "c")).toBe(false);
  });

  it("detects cycles through deeper chains", () => {
    // a → b → c → d. Adding d → b (d depends on b): d → b → c → d loops.
    const graph = edges([
      ["a", "b"],
      ["b", "c"],
      ["c", "d"],
    ]);
    expect(wouldCreateDependencyCycle(graph, "d", "b")).toBe(true);
    // Adding b → d (b depends on d): b → c → d and b → d, but no node loops back.
    expect(wouldCreateDependencyCycle(graph, "b", "d")).toBe(false);
    // d → a also loops: d → a → b → c → d.
    expect(wouldCreateDependencyCycle(graph, "d", "a")).toBe(true);
  });

  it("is unaffected by unrelated edges", () => {
    const graph = edges([
      ["x", "y"],
      ["y", "z"],
    ]);
    expect(wouldCreateDependencyCycle(graph, "a", "b")).toBe(false);
  });

  it("handles an empty graph", () => {
    expect(wouldCreateDependencyCycle([], "a", "b")).toBe(false);
  });

  it("ignores self-referential edges instead of looping forever", () => {
    const graph = edges([
      ["a", "a"],
      ["b", "a"],
    ]);
    expect(wouldCreateDependencyCycle(graph, "b", "a")).toBe(false);
    expect(wouldCreateDependencyCycle(graph, "a", "c")).toBe(false);
  });
});
