// Force-directed layout shared by the Mind map and Knowledge Graph pages.
// Pure function: given nodes + edges, run a fixed-iteration physics pass and
// return positions. Small graphs only (O(n²) repulsion) — fine for personal
// workspaces, same trade-off the mind map already made.

export interface LayoutNodeInput {
  id: string;
}

export interface LayoutNode extends LayoutNodeInput {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface LayoutEdge {
  source: string;
  target: string;
}

export const GRAPH_W = 1200;
export const GRAPH_H = 760;

export function forceLayout<N extends LayoutNodeInput>(
  nodes: N[],
  edges: LayoutEdge[],
  width = GRAPH_W,
  height = GRAPH_H,
  iterations = 350
): (N & LayoutNode)[] {
  const laid: (N & LayoutNode)[] = nodes.map((n, i) => ({
    ...n,
    x: width / 2 + Math.cos((i / Math.max(1, nodes.length)) * Math.PI * 2) * 220,
    y: height / 2 + Math.sin((i / Math.max(1, nodes.length)) * Math.PI * 2) * 160,
    vx: 0,
    vy: 0,
  }));
  const index = new Map(laid.map((n) => [n.id, n]));

  for (let iter = 0; iter < iterations; iter++) {
    const cooling = 1 - iter / iterations;
    // Repulsion (O(n²) but graphs are small).
    for (let i = 0; i < laid.length; i++) {
      for (let j = i + 1; j < laid.length; j++) {
        const a = laid[i];
        const b = laid[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.max(24, Math.hypot(dx, dy));
        const force = (3000 / dist) * cooling;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
    }
    // Springs along edges.
    for (const e of edges) {
      const a = index.get(e.source);
      const b = index.get(e.target);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const force = (dist - 140) * 0.02 * cooling;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }
    // Centering + damping.
    for (const n of laid) {
      n.vx += (width / 2 - n.x) * 0.005 * cooling;
      n.vy += (height / 2 - n.y) * 0.005 * cooling;
      n.vx *= 0.85;
      n.vy *= 0.85;
      n.x += n.vx;
      n.y += n.vy;
    }
  }
  return laid;
}
