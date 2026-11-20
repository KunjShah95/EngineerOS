import { ALL_TOPICS, TRACKS, getTopic, type Topic, type TrackId } from "@/content/learn";

export interface GraphNode {
  id: string;
  title: string;
  track: TrackId;
  level: Topic["level"];
  minutes: number;
  /** Longest prerequisite chain below this node. 0 means no prerequisites. */
  depth: number;
}

export interface GraphEdge {
  from: string; // prerequisite
  to: string; // dependent topic
  crossTrack: boolean;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** Longest-path depth per node. Throws on a cycle or an unknown prerequisite. */
export function computeDepths(topics: Topic[]): Map<string, number> {
  const byId = new Map(topics.map((t) => [t.id, t]));
  const depth = new Map<string, number>();
  const visiting = new Set<string>();

  const visit = (id: string): number => {
    const cached = depth.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) throw new Error(`Prerequisite cycle at "${id}"`);
    const topic = byId.get(id);
    if (!topic) throw new Error(`Unknown topic "${id}"`);
    visiting.add(id);
    let d = 0;
    for (const pre of topic.prerequisites) d = Math.max(d, visit(pre) + 1);
    visiting.delete(id);
    depth.set(id, d);
    return d;
  };

  for (const t of topics) visit(t.id);
  return depth;
}

export function buildGraph(topics: Topic[] = ALL_TOPICS): KnowledgeGraph {
  const depths = computeDepths(topics);
  const byId = new Map(topics.map((t) => [t.id, t]));
  const nodes: GraphNode[] = topics.map((t) => ({
    id: t.id,
    title: t.title,
    track: t.track,
    level: t.level,
    minutes: t.minutes,
    depth: depths.get(t.id) ?? 0,
  }));
  const edges: GraphEdge[] = topics.flatMap((t) =>
    t.prerequisites.map((pre) => ({
      from: pre,
      to: t.id,
      crossTrack: byId.get(pre)?.track !== t.track,
    }))
  );
  return { nodes, edges };
}

/** Every topic that must be learned before `id`, in a valid study order, ending with `id`. */
export function pathTo(id: string, topics: Topic[] = ALL_TOPICS): Topic[] {
  const byId = new Map(topics.map((t) => [t.id, t]));
  if (!byId.has(id)) return [];
  const depths = computeDepths(topics);
  const needed = new Set<string>();
  const walk = (cur: string) => {
    if (needed.has(cur)) return;
    needed.add(cur);
    for (const pre of byId.get(cur)?.prerequisites ?? []) walk(pre);
  };
  walk(id);
  return [...needed]
    .map((n) => byId.get(n)!)
    .sort((a, b) => (depths.get(a.id)! - depths.get(b.id)!) || a.title.localeCompare(b.title));
}

/** Topics that list `id` as a direct prerequisite. */
export function unlocks(id: string, topics: Topic[] = ALL_TOPICS): Topic[] {
  return topics.filter((t) => t.prerequisites.includes(id));
}

/** Topics a learner can start now given what they have completed. */
export function readyToLearn(completed: Iterable<string>, topics: Topic[] = ALL_TOPICS): Topic[] {
  const done = new Set(completed);
  return topics.filter((t) => !done.has(t.id) && t.prerequisites.every((p) => done.has(p)));
}

export interface LaidOutNode extends GraphNode {
  x: number;
  y: number;
}

export interface Layout {
  nodes: LaidOutNode[];
  width: number;
  height: number;
}

/**
 * Deterministic layered layout: x by prerequisite depth, y by order inside the
 * layer (grouped by track so lanes stay readable). Pure, so it is easy to test
 * and renders identically on server and client.
 */
export function layoutGraph(
  graph: KnowledgeGraph,
  opts: { colWidth?: number; rowHeight?: number; padX?: number; padY?: number } = {}
): Layout {
  const { colWidth = 220, rowHeight = 74, padX = 24, padY = 28 } = opts;
  const trackOrder: TrackId[] = TRACKS.map((t) => t.id);
  const layers = new Map<number, GraphNode[]>();
  for (const n of graph.nodes) {
    const list = layers.get(n.depth) ?? [];
    list.push(n);
    layers.set(n.depth, list);
  }
  const depths = [...layers.keys()].sort((a, b) => a - b);
  for (const d of depths) {
    layers.get(d)!.sort(
      (a, b) =>
        trackOrder.indexOf(a.track) - trackOrder.indexOf(b.track) || a.title.localeCompare(b.title)
    );
  }

  // Barycenter sweeps (forward, backward, forward): order each column by the
  // average row of its neighbours so edges cross less. Deterministic, no deps.
  const rowIndex = () => {
    const m = new Map<string, number>();
    for (const d of depths) layers.get(d)!.forEach((n, i) => m.set(n.id, i));
    return m;
  };
  const sweep = (direction: "forward" | "backward") => {
    const order = direction === "forward" ? depths : [...depths].reverse();
    for (const d of order) {
      const rows = rowIndex();
      const layer = layers.get(d)!;
      const bary = new Map<string, number>();
      for (const n of layer) {
        const neighbours =
          direction === "forward"
            ? graph.edges.filter((e) => e.to === n.id).map((e) => e.from)
            : graph.edges.filter((e) => e.from === n.id).map((e) => e.to);
        const idx = neighbours.map((id) => rows.get(id)).filter((v): v is number => v !== undefined);
        bary.set(n.id, idx.length ? idx.reduce((a, b) => a + b, 0) / idx.length : rows.get(n.id)!);
      }
      layer.sort(
        (a, b) =>
          bary.get(a.id)! - bary.get(b.id)! ||
          trackOrder.indexOf(a.track) - trackOrder.indexOf(b.track) ||
          a.title.localeCompare(b.title)
      );
    }
  };
  sweep("forward");
  sweep("backward");
  sweep("forward");

  let maxRows = 0;
  const placed: LaidOutNode[] = [];
  for (const d of depths) {
    const list = layers.get(d)!;
    maxRows = Math.max(maxRows, list.length);
    list.forEach((n, i) => {
      placed.push({ ...n, x: padX + d * colWidth, y: padY + i * rowHeight });
    });
  }
  const maxDepth = Math.max(0, ...graph.nodes.map((n) => n.depth));
  return {
    nodes: placed,
    width: padX * 2 + maxDepth * colWidth + 180,
    height: padY * 2 + Math.max(0, maxRows - 1) * rowHeight + 44,
  };
}

export function totalMinutes(ids: string[]): number {
  return ids.reduce((sum, id) => sum + (getTopic(id)?.minutes ?? 0), 0);
}
