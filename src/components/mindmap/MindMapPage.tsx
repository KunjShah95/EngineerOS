"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, Network, ZoomIn, ZoomOut } from "lucide-react";

import { PageLoader } from "@/components/shell/PageLoader";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/shell/EmptyState";
import {
  ProjectFilter,
  PROJECT_FILTER_ALL,
  type ProjectFilterValue,
} from "@/components/shell/ProjectFilter";
import { useMindMap, type MindMapNode } from "@/hooks/useMindMap";
import { useProjects } from "@/hooks/useProjects";
import { useWorkspace } from "@/hooks/useWorkspace";
import { forceLayout, GRAPH_H, GRAPH_W } from "@/lib/graph-layout";

function kindColor(kind: MindMapNode["kind"]): string {
  return kind === "project" ? "#4f46e5" : kind === "task" ? "#60a5fa" : "#818cf8";
}

export function MindMapPage() {
  const { data: workspace, isLoading } = useWorkspace();
  const workspaceId = workspace?.id ?? null;
  const { data: projects } = useProjects(workspaceId);
  const [projectFilter, setProjectFilter] = useState<ProjectFilterValue>(PROJECT_FILTER_ALL);
  const { data: graph, isLoading: graphLoading } = useMindMap(workspaceId, projectFilter);

  const [selected, setSelected] = useState<MindMapNode | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [dragId, setDragId] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);

  // Force-directed layout: repulsion + springs + centering, 350 iterations.
  // Shared with the knowledge graph via src/lib/graph-layout.ts.
  const layout = useMemo(
    () => (graph ? forceLayout(graph.nodes, graph.edges) : []),
    [graph]
  );

  // Auto-fit once the layout settles — adjust state during render (the
  // React-recommended pattern, no effect cascade). Only runs on the first
  // layout, before the user has panned/zoomed.
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
  const neighbors = useMemo(() => {
    if (!graph || !selected) return new Set<string>();
    const set = new Set<string>([selected.id]);
    for (const e of graph.edges) {
      if (e.source === selected.id) set.add(e.target);
      if (e.target === selected.id) set.add(e.source);
    }
    return set;
  }, [graph, selected]);

  const pan = (dx: number, dy: number) => setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
  const zoom = (factor: number) =>
    setView((v) => ({ ...v, k: Math.min(2.5, Math.max(0.2, v.k * factor)) }));

  const changeProject = (value: ProjectFilterValue) => {
    setProjectFilter(value);
    setSelected(null);
    // Back to identity so the auto-fit block re-fits the new subgraph.
    setView({ x: 0, y: 0, k: 1 });
  };

  const screenToWorld = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - view.x) / view.k,
      y: (clientY - rect.top - view.y) / view.k,
    };
  };

  if (isLoading || graphLoading) return <PageLoader label="Laying out your graph…" />;

  if (!graph || graph.nodes.length === 0) {
    return (
      <EmptyState
        icon={Network}
        title={projectFilter === PROJECT_FILTER_ALL ? "Nothing to map yet" : "No nodes in this view"}
        description={
          projectFilter === PROJECT_FILTER_ALL
            ? "Create a project, task, or note and it will show up here as a node."
            : "This project (or unfiled items) has no nodes yet. Switch the filter to see more."
        }
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <PageHeader
          icon={Network}
          title="Mind map"
          className="mb-0"
          description={`${graph.nodes.length} nodes · ${graph.edges.length} connections — projects, tasks, notes, and links`}
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
                {selected ? selected.label.slice(0, 28) : "drag to pan · scroll to zoom"}
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
            {graph.edges.map((e, i) => {
              const a = nodeById.get(e.source);
              const b = nodeById.get(e.target);
              if (!a || !b) return null;
              const active = selected && (a.id === selected.id || b.id === selected.id);
              return (
                <line
                  key={i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={active ? "#4f46e5" : "#35363f"}
                  strokeWidth={active ? 1.5 : 1}
                  opacity={active ? 0.9 : 0.55}
                />
              );
            })}

            {/* Nodes */}
            {layout.map((n) => {
              const isSelected = selected?.id === n.id;
              const isNeighbor = selected ? neighbors.has(n.id) : true;
              const dimmed = selected ? !neighbors.has(n.id) : false;
              const color = n.color ?? kindColor(n.kind);
              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x} ${n.y})`}
                  className="cursor-pointer"
                  opacity={dimmed ? 0.3 : 1}
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
                    setSelected(n);
                  }}
                >
                  <circle
                    r={n.kind === "project" ? 26 : 20}
                    fill={isSelected || isNeighbor ? color : color}
                    fillOpacity={isSelected ? 1 : 0.14}
                    stroke={color}
                    strokeWidth={isSelected ? 2 : 1.25}
                  />
                  <text
                    textAnchor="middle"
                    dy="0.35em"
                    fontSize={n.kind === "project" ? 10 : 8.5}
                    fontWeight={n.kind === "project" ? 600 : 500}
                    fill="#e8e9ed"
                    style={{ pointerEvents: "none" }}
                  >
                    {n.label.slice(0, 22)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Detail side panel */}
        {selected && (
          <div className="absolute top-3 right-3 w-64 rounded-lg border border-default bg-elevated p-4 shadow-xl">
            <div className="mb-1 flex items-center gap-2">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: selected.color ?? kindColor(selected.kind) }}
              />
              <p className="text-sm font-semibold text-foreground">{selected.label}</p>
            </div>
            <p className="mb-3 text-xs text-faint capitalize">{selected.kind} · {selected.meta}</p>
            <Link
              href={selected.kind === "project" ? `/projects/${selected.id}` : selected.kind === "task" ? `/tasks?task=${selected.id}` : `/notes/${selected.id}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-accent transition-colors hover:text-accent-hover"
            >
              Open
              <ExternalLink className="size-3" strokeWidth={1.75} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
