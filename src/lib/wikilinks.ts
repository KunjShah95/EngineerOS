// Obsidian-style wikilinks: [[Some Title]]. Extracting + resolving them powers
// Phase 9's auto-detected backlinks — when note A's body mentions [[B]], the
// graph draws a wikilink edge A→B and B's detail page lists A as a backlink.

const WIKILINK_RE = /\[\[([^\[\]]+)\]\]/g;

/** All [[...]] targets mentioned in a piece of markdown, trimmed + deduped. */
export function extractWikilinks(text: string): string[] {
  const out: string[] = [];
  if (!text) return out;
  for (const m of text.matchAll(WIKILINK_RE)) {
    const target = m[1].trim();
    if (target && !out.includes(target)) out.push(target);
  }
  return out;
}

/** Title→id map built from any entity list that has id + title. */
export type WikilinkIndexEntry = { id: string; kind: string };
export type WikilinkIndex = Map<string, WikilinkIndexEntry>;

/**
 * Build a case-insensitive title index. First-seen wins so collisions resolve
 * to the earliest entity (callers should order notes before tasks/resources).
 */
export function buildWikilinkIndex(
  rows: { id: string; kind: string; title: string }[]
): WikilinkIndex {
  const index: WikilinkIndex = new Map();
  for (const r of rows) {
    const key = r.title.trim().toLowerCase();
    if (key && !index.has(key)) index.set(key, { id: r.id, kind: r.kind });
  }
  return index;
}

/** Resolve one [[target]] to an entity id, or null when nothing matches. */
export function resolveWikilink(index: WikilinkIndex, target: string) {
  return index.get(target.trim().toLowerCase()) ?? null;
}
