/** A "task A depends on task B" edge. */
export interface DependencyEdge {
  task_id: string;
  depends_on_task_id: string;
}

/**
 * Would adding `taskId → newDependencyId` create a cycle in the given graph?
 *
 * Edges point "depends on": `task_id` depends on `depends_on_task_id`. Adding
 * the new edge creates a loop exactly when `newDependencyId` can already reach
 * `taskId` transitively (then taskId → newDependencyId → … → taskId).
 */
export function wouldCreateDependencyCycle(
  edges: readonly DependencyEdge[],
  taskId: string,
  newDependencyId: string
): boolean {
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.task_id === edge.depends_on_task_id) continue; // self-edges are invalid anyway
    const list = outgoing.get(edge.task_id) ?? [];
    list.push(edge.depends_on_task_id);
    outgoing.set(edge.task_id, list);
  }

  const stack = [newDependencyId];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === taskId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const next of outgoing.get(current) ?? []) stack.push(next);
  }
  return false;
}

/** Thrown when a dependency link would create a loop. */
export class DependencyCycleError extends Error {
  constructor() {
    super("This dependency would create a loop");
    this.name = "DependencyCycleError";
  }
}
