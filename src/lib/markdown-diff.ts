import { diffLines, diffWordsWithSpace } from "diff";

/**
 * Word-level segment inside a changed line.
 * `same` segments render plain; `added`/`removed` get highlight color.
 */
export interface DiffSegment {
  text: string;
  kind: "added" | "removed" | "same";
}

/** One rendered row of the diff. */
export interface DiffLine {
  kind: "added" | "removed" | "same";
  text: string;
  /** Present on changed rows: intra-line word highlights. */
  segments?: DiffSegment[];
}

export interface NoteDiff {
  lines: DiffLine[];
  /** Number of added lines (a changed pair counts one of each). */
  added: number;
  /** Number of removed lines (a changed pair counts one of each). */
  removed: number;
}

/** Split on newlines, dropping only the trailing artifact of a jsdiff value. */
function splitLines(value: string): string[] {
  const parts = value.split("\n");
  if (parts[parts.length - 1] === "") parts.pop();
  return parts;
}

/** Word-diff one removed line against one added line (GitHub-style pair). */
function wordDiffForPair(removed: string, added: string): {
  removed: DiffSegment[];
  added: DiffSegment[];
} {
  const segments = diffWordsWithSpace(removed, added).map((s) => ({
    text: s.value,
    kind: (s.added ? "added" : s.removed ? "removed" : "same") as DiffSegment["kind"],
  }));
  return {
    removed: segments.filter((s) => s.kind !== "added"),
    added: segments.filter((s) => s.kind !== "removed"),
  };
}

/**
 * Compute a GitHub-style diff between two markdown bodies.
 *
 * Changed lines are emitted as a removed row + an added row (word-level
 * highlights included); unchanged lines pass through as context. Line counts
 * are returned for the "+N −M" stats shown next to each version.
 */
/**
 * Cheap change counts (no word-diff work) — feeds the per-version "+N −M"
 * chips in the timeline without paying for full segment highlighting.
 */
export function diffStats(prev: string, next: string): { added: number; removed: number } {
  const parts = diffLines(prev, next);
  let added = 0;
  let removed = 0;
  for (const part of parts) {
    if (part.added) added += part.count ?? 0;
    else if (part.removed) removed += part.count ?? 0;
  }
  return { added, removed };
}

export function diffMarkdown(prev: string, next: string): NoteDiff {
  const parts = diffLines(prev, next);
  const lines: DiffLine[] = [];
  let added = 0;
  let removed = 0;

  // jsdiff emits removed lines immediately before the added lines that
  // replaced them; buffer them so we can pair them up for word diffs.
  let pendingRemoved: string[] = [];

  const flushRemoved = () => {
    for (const line of pendingRemoved) {
      lines.push({ kind: "removed", text: line });
      removed += 1;
    }
    pendingRemoved = [];
  };

  for (const part of parts) {
    if (part.removed) {
      pendingRemoved.push(...splitLines(part.value));
    } else if (part.added) {
      const addedLines = splitLines(part.value);
      const pairs = Math.min(addedLines.length, pendingRemoved.length);
      for (let i = 0; i < pairs; i += 1) {
        const { removed: rSegs, added: aSegs } = wordDiffForPair(
          pendingRemoved[i],
          addedLines[i]
        );
        lines.push({ kind: "removed", text: pendingRemoved[i], segments: rSegs });
        lines.push({ kind: "added", text: addedLines[i], segments: aSegs });
        removed += 1;
        added += 1;
      }
      for (let i = pairs; i < addedLines.length; i += 1) {
        lines.push({ kind: "added", text: addedLines[i] });
        added += 1;
      }
      for (let i = pairs; i < pendingRemoved.length; i += 1) {
        lines.push({ kind: "removed", text: pendingRemoved[i] });
        removed += 1;
      }
      pendingRemoved = [];
    } else {
      flushRemoved();
      for (const line of splitLines(part.value)) {
        lines.push({ kind: "same", text: line });
      }
    }
  }
  flushRemoved();

  return { lines, added, removed };
}
