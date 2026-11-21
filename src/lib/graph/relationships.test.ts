import { describe, expect, it } from "vitest";
import {
  connectedContext,
  liveEdges,
  markStaleEdges,
  pruneEdges,
  traverse,
  type Relationship,
} from "./relationships";

const edges: Relationship[] = [
  { id: "e1", type: "belongs_to", from: "t1", fromType: "task", to: "p1", toType: "project", provenance: "task.project_id", createdAt: 1 },
  { id: "e2", type: "blocked_by", from: "t1", fromType: "task", to: "t2", toType: "task", provenance: "task.dependencies", createdAt: 1 },
  { id: "e3", type: "documented_in", from: "d1", fromType: "decision", to: "n1", toType: "note", provenance: "decision.note_id", createdAt: 1 },
];

describe("graph relationships", () => {
  it("traverses one hop", () => {
    const r = traverse(edges, "t1", 1);
    expect(r.nodes.map((n) => n.id)).toContain("p1");
    expect(r.nodes.map((n) => n.id)).toContain("t2");
    expect(r.edges.length).toBe(2);
  });

  it("traverses two hops", () => {
    const more: Relationship[] = [...edges, { id: "e4", type: "links_to", from: "t2", fromType: "task", to: "n2", toType: "note", provenance: "x", createdAt: 1 }];
    const r = traverse(more, "t1", 2);
    expect(r.nodes.map((n) => n.id)).toContain("n2");
  });

  it("skips stale edges by default", () => {
    const stale = edges.map((e) => (e.id === "e1" ? { ...e, stale: true } : e));
    const r = traverse(stale, "t1", 1);
    expect(r.skipped.length).toBe(1);
    expect(r.nodes.map((n) => n.id)).not.toContain("p1");
  });

  it("skips deleted edges by default", () => {
    const del = edges.map((e) => (e.id === "e2" ? { ...e, deleted: true } : e));
    const r = traverse(del, "t1", 1);
    expect(r.nodes.map((n) => n.id)).not.toContain("t2");
  });

  it("connectedContext excludes seeds", () => {
    const ctx = connectedContext(edges, ["t1"], 1);
    expect(ctx).toContain("p1");
    expect(ctx).toContain("t2");
    expect(ctx).not.toContain("t1");
  });

  it("pruneEdges marks deleted when endpoint missing", () => {
    const out = pruneEdges(edges, new Set(["t1", "t2"]));
    const e1 = out.find((e) => e.id === "e1")!;
    expect(e1.deleted).toBe(true);
  });

  it("markStaleEdges marks stale", () => {
    const out = markStaleEdges(edges, { t1: 5 });
    const e1 = out.find((e) => e.id === "e1")!;
    expect(e1.stale).toBe(true);
  });

  it("liveEdges filters stale/deleted", () => {
    const mixed = edges.map((e, i) => (i === 0 ? { ...e, stale: true } : e));
    expect(liveEdges(mixed).length).toBe(edges.length - 1);
  });
});