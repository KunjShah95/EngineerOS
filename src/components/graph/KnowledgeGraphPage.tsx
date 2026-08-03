"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, GitFork, ZoomIn, ZoomOut } from "lucide-react";

import { PageLoader } from "@/components/shell/PageLoader";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/shell/EmptyState";
import {
  ProjectFilter,
  PROJECT_FILTER_ALL,
  PROJECT_FILTER_UNFILED,
  type ProjectFilterValue,
} from "@/components/shell/ProjectFilter";
import { forceLayout, GRAPH_H, GRAPH_W } from "@/lib/graph-layout";
import { useKnowledgeGraph } from "@/hooks/useKnowledgeGraph";
import { useProjects } from "@/hooks/useProjects";
import { useWorkspace } from "@/hooks/useWorkspace";
import type { GraphEdge, GraphNode } from "@/types/database";

// Navy/indigo palette: notes = indigo, tasks = blue, resources = violet-navy.
const KIND_COLOR: Record<GraphNode["kind"], string> = {
  note: "#818cf8",
  task: "#60a5fa",
  resource: "#94a3f8",
};

// Edge styling per kind (the legend below explains each).
const EDGE_STYLE: Record<GraphEdge["kind"], { stroke: string; dash?: string; width: number; opacity: number }> = {
  task_note: { stroke: "#475569", width: 1, opacity: 0.6 },
  note_link: { stroke: "#818cf8", width: 1.25, opacity: 0.8 },
  wikilink: { stroke: "#38bdf8", dash: "4 4", width: 1, opacity: 0.7 },
};

const EDGE_LABEL: Record<GraphEdge["kind"], string> = {
  task_note: "Task ↔ note",
  note_link: "Explicit link",
  wikilink: "[[Wikilink]]",
};

interface NeighborEntry {
  node: GraphNode;
  edge: GraphEdge;
}

export function KnowledgeGraphPage() {
  const { data: workspace, isLoading } = useWorkspace();
  const workspaceId = workspace?.id ?? null;
  const { data: projects } = useProjects(workspaceId);
  const { data: graph, isLoading: graphLoading } = useKnowledgeGraph(workspaceId);

  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [dragId, setDragId] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const [projectFilter, setProjectFilter] = useState<ProjectFilterValue>(PROJECT_FILTER_ALL);
  const svgRef = useRef<SVGSVGElement>(null);

  const changeProject = (value: ProjectFilterValue) => {
    setProjectFilter(value);
    setSelected(null);
    // Back to identity so the auto-fit block re-fits the new subgraph.
    setView({ x: 0, y: 0, k: 1 });
  };

  // Project filter: keep nodes owned by the chosen project (or everything for
  // "All projects"; unfiled = project_id null). Edges survive only when both
  // endpoints are in the filtered set.
  const filtered = useMemo(() => {
    if (!graph) return { nodes: [], edges: [] as GraphEdge[] };
    const unfiled = projectFilter === PROJECT_FILTER_UNFILED;
    const projectId = !unfiled && projectFilter !== PROJECT_FILTER_ALL ? projectFilter : null;
    const nodes = graph.nodes.filter((n) => (unfiled ? n.project_id === null : projectId ? n.project_id === projectId : true));
    const ids = new Set(nodes.map((n) => n.id));
    const edges = graph.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
    return { nodes, edges };
  }, [graph, projectFilter]);

  // Force-directed layout shared with the mind map (pure function).
  const layout = useMemo(
    () => (filtered.nodes.length ? forceLayout(filtered.nodes, filtered.edges) : []),
    [filtered]
  );

  // Auto-fit once the layout settles — adjust state during render.
  if (layout.length > 0 && view.k === 1 && view.x === 0 && view.y === 0) {
    const xs = layout.map((n) => n.x);
    const ys = layout.map((n) => n.y);
    const minX = Math.min(...xs) - 120;
    const maxX = Math.max(...xs) + 120;
    const minY = Math.min(...ys) - 120;
    const maxY = Math.max(...ys) + 120;
    const k = Math.min(1.4, Math.max(0.35, Math.min(GRAPH_H / (maxY - minY), GRAPH_W / (maxX - minX))));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setView({ k, x: GRAPH_W / 2 - cx * k, y: GRAPH_H / 2 - cy * k });
  }

  const nodeById = useMemo(() => new Map(layout.map((n) => [n.id, n])), [layout]);

  // Neighbors of the selected node with the edge that connects them — this is
  // the backlink view: what links to / from the selection.
  const neighbors = useMemo<NeighborEntry[]>(() => {
    if (!graph || !selected) return [];
    const out: NeighborEntry[] = [];
    for (const e of graph.edges) {
      if (e.source === selected.id) {
        const n = nodeById.get(e.target);
        if (n) out.push({ node: n, edge: e });
      } else if (e.target === selected.id) {
        const n = nodeById.get(e.source);
        if (n) out.push({ node: n, edge: e });
      }
    }
    return out;
  }, [graph, selected, nodeById]);

  const neighborIds = useMemo(() => new Set(neighbors.map((n) => n.node.id)), [neighbors]);

  const pan = (dx: number, dy: number) => setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
  const zoom = (factor: number) => setView((v) => ({ ...v, k: Math.min(2.5, Math.max(0.2, v.k * factor)) }));

  const screenToWorld = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - view.x) / view.k,
      y: (clientY - rect.top - view.y) / view.k,
    };
  };

  if (isLoading || graphLoading) return <PageLoader label="Laying out your knowledge graph…" />;

  if (!graph || graph.nodes.length === 0) {
    return (
      <EmptyState
        icon={GitFork}
        title="Nothing to graph yet"
        description="Create a note, task, or resource and it will appear here. Link notes with [[Title]] or the link button to draw backlinks."
      />
    );
  }

  if (filtered.nodes.length === 0) {
    return (
      <EmptyState
        icon={GitFork}
        title="No entities in this view"
        description="This project (or unfiled items) has no graph nodes yet. Switch the filter to see more."
      />
    );
  }

  const visibleNodes = layout;
  const visibleEdges = filtered.edges;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <PageHeader
          icon={GitFork}
          title="Knowledge graph"
          className="mb-0"
          description={`${filtered.nodes.length} entities · ${filtered.edges.length} connections — notes, tasks, resources & backlinks`}
          actions={
            <div className="flex items-center gap-3">
          <ProjectFilter
            value={projectFilter}
            onChange={changeProject}
            projects={projects ?? []}
          />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => zoom(1.2)}
              className="rounded-md p-2 text-secondary transition-colors hover:bg-surface-hover hover:text-foreground"
              aria-label="Zoom in"
            >
              <ZoomIn className="size-4" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => zoom(1 / 1.2)}
              className="rounded-md p-2 text-secondary transition-colors hover:bg-surface-hover hover:text-foreground"
              aria-label="Zoom out"
            >
              <ZoomOut className="size-4" strokeWidth={1.75} />
            </button>
              <span className="ml-2 font-mono text-xs text-faint">
                {selected ? "click node to clear" : "drag to pan · scroll to zoom"}
              </span>
            </div>
            </div>
          }
        />
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-default bg-surface/40 m-4 mt-0">
        <svg
          ref={svgRef}
          className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
          viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`}
          onWheel={(e) => {
            e.preventDefault();
            const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
            zoom(factor);
          }}
          onPointerDown={(e) => {
            (e.target as Element).setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (e.buttons !== 1 || dragId) return;
            pan(e.movementX, e.movementY);
          }}
        >
          <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
            {/* Edges */}
            {visibleEdges.map((e, i) => {
              const a = nodeById.get(e.source);
              const b = nodeById.get(e.target);
              if (!a || !b) return null;
              const active = selected && (a.id === selected.id || b.id === selected.id);
              const style = EDGE_STYLE[e.kind];
              return (
                <line
                  key={`${e.source}-${e.target}-${e.kind}-${i}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={style.stroke}
                  strokeWidth={active ? style.width + 1 : style.width}
                  strokeDasharray={style.dash}
                  opacity={active ? 0.95 : style.opacity * (selected ? 0.35 : 1)}
                />
              );
            })}

            {/* Nodes */}
            {visibleNodes.map((n) => {
              const isSelected = selected?.id === n.id;
              const isNeighbor = selected ? neighborIds.has(n.id) : true;
              const dimmed = selected ? !isNeighbor && !isSelected : false;
              const color = KIND_COLOR[n.kind];
              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x} ${n.y})`}
                  className="cursor-pointer"
                  opacity={dimmed ? 0.25 : 1}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setDragId(n.id);
                  }}
                  onPointerMove={(e) => {
                    if (dragId !== n.id) return;
                    const p = screenToWorld(e.clientX, e.clientY);
                    const node = nodeById.get(n.id);
                    if (node) {
                      node.x = p.x;
                      node.y = p.y;
                      setTick((t) => t + 1);
                    }
                  }}
                  onPointerUp={() => setDragId(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected(isSelected ? null : n);
                  }}
                >
                  <circle
                    r={n.kind === "note" ? 22 : n.kind === "task" ? 18 : 15}
                    fill={color}
                    fillOpacity={isSelected ? 1 : isNeighbor || !selected ? 0.14 : 0.05}
                    stroke={color}
                    strokeWidth={isSelected ? 2 : 1.25}
                  />
                  <text
                    textAnchor="middle"
                    dy="0.35em"
                    fontSize={n.kind === "note" ? 9 : 8}
                    fontWeight={n.kind === "note" ? 600 : 500}
                    fill="#e8e9ed"
                    style={{ pointerEvents: "none" }}
                  >
                    {n.label.slice(0, 20)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Legend */}
        <div className="absolute top-3 left-3 rounded-lg border border-border-subtle bg-elevated/90 px-3 py-2.5 text-[11px] backdrop-blur">
          <p className="mb-1.5 font-medium text-foreground">Connections</p>
          {(Object.keys(EDGE_LABEL) as GraphEdge["kind"][]).map((kind) => {
            const style = EDGE_STYLE[kind];
            return (
              <div key={kind} className="flex items-center gap-2 py-0.5 text-secondary">
                <svg width="22" height="6" aria-hidden>
                  <line
                    x1="0"
                    y1="3"
                    x2="22"
                    y2="3"
                    stroke={style.stroke}
                    strokeWidth={style.width}
                    strokeDasharray={style.dash}
                  />
                </svg>
                {EDGE_LABEL[kind]}
              </div>
            );
          })}
          <div className="mt-1.5 flex items-center gap-2 border-t border-border-subtle pt-1.5 text-secondary">
            <span className="size-2 rounded-full" style={{ backgroundColor: KIND_COLOR.note }} />
            note
            <span className="size-2 rounded-full" style={{ backgroundColor: KIND_COLOR.task }} />
            task
            <span className="size-2 rounded-full" style={{ backgroundColor: KIND_COLOR.resource }} />
            resource
          </div>
        </div>

        {/* Detail / backlinks panel */}
        {selected && (
          <div className="absolute top-3 right-3 flex max-h-[calc(100%-1.5rem)] w-72 flex-col rounded-lg border border-default bg-elevated p-4 shadow-xl">
            <div className="mb-1 flex items-center gap-2">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: KIND_COLOR[selected.kind] }}
              />
              <p className="truncate text-sm font-semibold text-foreground">{selected.label}</p>
            </div>
            <p className="mb-3 text-xs text-faint capitalize">
              {selected.kind} · {selected.meta}
            </p>

            <p className="mb-1.5 text-[11px] font-semibold text-faint uppercase">
              {neighbors.length} connection{neighbors.length === 1 ? "" : "s"}
            </p>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
              {neighbors.length === 0 && (
                <p className="text-xs text-faint">No connections yet. Link it with [[Title]] in a note.</p>
              )}
              {neighbors.slice(0, 24).map(({ node, edge }) => (
                <Link
                  key={`${node.id}-${edge.kind}`}
                  href={node.href}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-secondary transition-colors hover:bg-surface-hover hover:text-foreground"
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: KIND_COLOR[node.kind] }}
                  />
                  <span className="min-w-0 flex-1 truncate">{node.label}</span>
                  <span
                    className="shrink-0 rounded-full border border-border-subtle px-1.5 py-px text-[9px] text-faint"
                    title={EDGE_LABEL[edge.kind]}
                  >
                    {edge.kind === "task_note" ? "task" : edge.kind === "note_link" ? "link" : "wiki"}
                  </span>
                </Link>
              ))}
            </div>

            <Link
              href={selected.href}
              className="mt-3 inline-flex items-center gap-1 border-t border-border-subtle pt-3 text-xs font-medium text-accent transition-colors hover:text-accent-hover"
            >
              Open {selected.kind}
              <ExternalLink className="size-3" strokeWidth={1.75} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
