/**
 * Typed knowledge-graph relationships (improvement B).
 *
 * A visualization is not enough if the assistant ignores relationships. This
 * module defines typed edges with provenance and supports traversal, plus
 * explicit handling of stale/deleted records.
 */

export type RelationType =
  | "belongs_to" // task -> project
  | "documented_in" // decision -> note
  | "blocked_by" // task -> task
  | "links_to" // note -> note (wikilink)
  | "member_of"; // generic

export interface Relationship {
  id: string;
  type: RelationType;
  from: string; // entity id
  fromType: string; // entity type
  to: string;
  toType: string;
  provenance: string; // source of the edge (e.g. "note.frontmatter.project")
  createdAt: number;
  /** Marked stale when an endpoint changes; traversal skips stale edges by default. */
  stale?: boolean;
  /** Marked when an endpoint was deleted; traversal skips deleted edges. */
  deleted?: boolean;
}

export interface GraphNode {
  id: string;
  type: string;
}

export interface TraversalResult {
  nodes: GraphNode[];
  edges: Relationship[];
  /** Edges skipped because an endpoint was stale or deleted. */
  skipped: Relationship[];
}

/**
 * Build an adjacency index from a list of relationships.
 */
export function indexEdges(edges: Relationship[]): Map<string, Relationship[]> {
  const m = new Map<string, Relationship[]>();
  for (const e of edges) {
    const list = m.get(e.from) ?? [];
    list.push(e);
    m.set(e.from, list);
  }
  return m;
}

/**
 * Traverse the graph from a starting node up to `depth` hops.
 * Skips stale/deleted edges unless includeStale is set.
 */
export function traverse(
  edges: Relationship[],
  startId: string,
  depth = 1,
  options: { includeStale?: boolean; includeDeleted?: boolean } = {}
): TraversalResult {
  const adj = indexEdges(edges);
  const visitedNodes = new Set<string>([startId]);
  const visitedEdges = new Set<string>();
  const outNodes: GraphNode[] = [{ id: startId, type: "unknown" }];
  const outEdges: Relationship[] = [];
  const skipped: Relationship[] = [];

  let frontier: string[] = [startId];
  for (let hop = 0; hop < depth; hop++) {
    const nextFrontier: string[] = [];
    for (const cur of frontier) {
      for (const e of adj.get(cur) ?? []) {
        if (visitedEdges.has(e.id)) continue;
        if (e.deleted && !options.includeDeleted) {
          skipped.push(e);
          visitedEdges.add(e.id);
          continue;
        }
        if (e.stale && !options.includeStale) {
          skipped.push(e);
          visitedEdges.add(e.id);
          continue;
        }
        visitedEdges.add(e.id);
        outEdges.push(e);
        if (!visitedNodes.has(e.to)) {
          visitedNodes.add(e.to);
          outNodes.push({ id: e.to, type: e.toType });
          nextFrontier.push(e.to);
        }
      }
    }
    frontier = nextFrontier;
  }

  return { nodes: outNodes, edges: outEdges, skipped };
}

/**
 * Retrieve connected context: given seed entity ids, expand by traversal and
 * return the connected entity ids (excluding seeds) up to depth.
 */
export function connectedContext(
  edges: Relationship[],
  seeds: string[],
  depth = 1
): string[] {
  const out = new Set<string>();
  for (const s of seeds) {
    const r = traverse(edges, s, depth);
    for (const n of r.nodes) {
      if (!seeds.includes(n.id)) out.add(n.id);
    }
  }
  return [...out];
}

/**
 * Mark edges stale/deleted when their endpoints are removed.
 * Returns a new array; does not mutate input.
 */
export function pruneEdges(
  edges: Relationship[],
  liveEntityIds: Set<string>
): Relationship[] {
  return edges.map((e) => {
    const fromLive = liveEntityIds.has(e.from);
    const toLive = liveEntityIds.has(e.to);
    if (!fromLive || !toLive) {
      return { ...e, deleted: true };
    }
    return { ...e };
  });
}

/**
 * Mark edges stale when endpoint metadata changed after edge creation.
 * `changedAfter` maps entity id -> last changed timestamp.
 */
export function markStaleEdges(
  edges: Relationship[],
  changedAfter: Record<string, number>
): Relationship[] {
  return edges.map((e) => {
    const fromChanged = changedAfter[e.from];
    const toChanged = changedAfter[e.to];
    const stale =
      (typeof fromChanged === "number" && fromChanged > e.createdAt) ||
      (typeof toChanged === "number" && toChanged > e.createdAt);
    return stale ? { ...e, stale: true } : { ...e };
  });
}

/**
 * Explicit handling of stale/deleted records in retrieval: filter them out.
 */
export function liveEdges(edges: Relationship[]): Relationship[] {
  return edges.filter((e) => !e.deleted && !e.stale);
}
