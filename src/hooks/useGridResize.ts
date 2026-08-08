import { useState, type PointerEvent } from "react";

import {
  MIN_BLOCK_HEIGHT,
  MINUTE_SNAP,
  resizeEventOnDay,
  snapMinutes,
  type TimedLayout,
} from "@/lib/calendar-grid";

/** Snapshot of one resize drag (all captured at pointerdown). */
interface ResizeState {
  edge: "start" | "end";
  minutes: number;
  /** Pointer Y at drag start — delta is relative, so no rect math needed. */
  startY: number;
  baseStart: number;
  baseEnd: number;
}

/**
 * Pointer-based drag-to-resize for one timed grid block — shared by event
 * blocks and timed task blocks. The block's edge handles call `beginResize`;
 * the returned `topPx`/`heightPx` drive the live preview; `pointerup` commits
 * through `onResize`. Handles call `stopPropagation`, so dnd-kit's move-drag
 * and the column's create-select never start.
 */
export function useGridResize({
  id,
  startsAt,
  endsAt,
  dayIso,
  layout,
  hourHeight,
  onResize,
}: {
  id: string;
  startsAt: string;
  endsAt: string;
  dayIso: string;
  layout: TimedLayout;
  hourHeight: number;
  onResize: (id: string, startsAt: string, endsAt: string) => void;
}) {
  const [resize, setResize] = useState<ResizeState | null>(null);

  const startMin = (layout.topPx / hourHeight) * 60;
  const endMin = startMin + (layout.heightPx / hourHeight) * 60;

  const beginResize = (edge: "start" | "end") => (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation(); // don't start the move drag / column create-select
    setResize({
      edge,
      minutes: edge === "start" ? startMin : endMin,
      startY: e.clientY,
      baseStart: startMin,
      baseEnd: endMin,
    });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const moveResize = (e: PointerEvent<HTMLDivElement>) => {
    if (!resize) return;
    const { edge, startY, baseStart, baseEnd } = resize;
    const delta = ((e.clientY - startY) / hourHeight) * 60;
    // Compute from the drag base, not the last snapped value — accumulating
    // from snapped minutes makes the preview jump a whole snap step when the
    // pointer reverses direction (e.g. 9:26 → snap 9:30, then 9:25 → 9:00).
    const base = edge === "start" ? baseStart : baseEnd;
    let next = snapMinutes(base + delta);
    // Keep the visible slice ≥ MINUTE_SNAP so the preview never collapses.
    if (edge === "start") next = Math.min(next, baseEnd - MINUTE_SNAP);
    else next = Math.max(next, baseStart + MINUTE_SNAP);
    setResize({ ...resize, minutes: next });
  };

  const endResize = () => {
    if (!resize) return;
    const { edge, minutes, baseStart, baseEnd } = resize;
    setResize(null);
    // A bare click, or a drag that returned to the original bucket, is a no-op.
    if (minutes === (edge === "start" ? baseStart : baseEnd)) return;
    const resized = resizeEventOnDay(
      { id, starts_at: startsAt, ends_at: endsAt },
      dayIso,
      edge,
      minutes
    );
    if (!resized) return; // below min duration — treat as a no-op
    if (resized.starts_at === startsAt && resized.ends_at === endsAt) return;
    onResize(id, resized.starts_at, resized.ends_at);
  };

  const topPx =
    resize && resize.edge === "start" ? (resize.minutes / 60) * hourHeight : layout.topPx;
  const heightPx =
    resize && resize.edge === "end"
      ? Math.max(MIN_BLOCK_HEIGHT, ((resize.minutes - startMin) / 60) * hourHeight)
      : resize && resize.edge === "start"
        ? Math.max(MIN_BLOCK_HEIGHT, ((endMin - resize.minutes) / 60) * hourHeight)
        : layout.heightPx;

  // Live resized range during a drag (null when the drag produced an invalid
  // slice — the block is at min height anyway); null when not resizing.
  const resized = resize
    ? resizeEventOnDay(
        { id, starts_at: startsAt, ends_at: endsAt },
        dayIso,
        resize.edge,
        resize.minutes
      )
    : null;

  return { beginResize, moveResize, endResize, topPx, heightPx, resized };
}
