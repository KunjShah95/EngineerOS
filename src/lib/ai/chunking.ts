/**
 * Structure-aware chunking for the embedding index.
 *
 * The previous chunker collapsed all whitespace and cut on fixed character
 * windows. That has two measurable costs:
 *
 *  1. Markdown structure is destroyed before it can be used. Headings are the
 *     author's own statement of where topics change — far better split points
 *     than an arbitrary offset.
 *  2. Only the first chunk carried the entity title, so later chunks lost all
 *     sense of what document they belonged to and ranked poorly for queries
 *     that mentioned the title.
 *
 * This splits on headings first, then falls back to paragraph-aware windowing
 * for sections that are still too long, and prepends the title to every chunk.
 */

export const CHUNK_TARGET = 1400;
export const CHUNK_OVERLAP = 200;
/** Sections below this merge into the next one rather than standing alone. */
const MIN_SECTION = 220;

const HEADING = /^#{1,6}\s+\S/;

type Section = { heading: string | null; body: string };

/** Split markdown into sections at ATX headings, preserving the heading text. */
function splitOnHeadings(markdown: string): Section[] {
  const lines = markdown.split(/\r?\n/);
  const sections: Section[] = [];
  let heading: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    const body = buffer.join("\n").trim();
    if (body || heading) sections.push({ heading, body });
    buffer = [];
  };

  let inFence = false;
  for (const line of lines) {
    // Never split inside a fenced code block — a `#` comment in shell or
    // Python looks exactly like an ATX heading.
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;

    if (!inFence && HEADING.test(line)) {
      flush();
      heading = line.replace(/^#{1,6}\s+/, "").trim();
    } else {
      buffer.push(line);
    }
  }
  flush();

  return sections.filter((s) => s.body.trim() || s.heading);
}

/**
 * Window a long section on paragraph boundaries, falling back to a hard cut
 * only when a single paragraph exceeds the target size.
 */
function windowSection(text: string, target: number, overlap: number): string[] {
  if (text.length <= target) return [text];

  const paragraphs = text.split(/\n{2,}/);
  const out: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (para.length > target) {
      if (current.trim()) {
        out.push(current.trim());
        current = "";
      }
      // A single oversized paragraph (a table, a long code block): hard-cut it
      // with overlap so a fact straddling the boundary survives in one piece.
      for (let i = 0; i < para.length; i += target - overlap) {
        out.push(para.slice(i, i + target).trim());
      }
      continue;
    }

    if (current.length + para.length + 2 > target) {
      if (current.trim()) out.push(current.trim());
      // Carry the tail of the previous chunk forward as overlap.
      const tail = current.slice(-overlap).trim();
      current = tail ? `${tail}\n\n${para}` : para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }

  if (current.trim()) out.push(current.trim());
  return out.filter(Boolean);
}

export interface ChunkOptions {
  target?: number;
  overlap?: number;
  /** Prepended to every chunk so no chunk loses its document context. */
  title?: string;
}

/**
 * Chunk a markdown document for embedding.
 *
 * Returns chunks that each carry their document title and section heading, so
 * a chunk is interpretable — and rankable — on its own.
 */
export function chunkMarkdown(markdown: string, options: ChunkOptions = {}): string[] {
  const { target = CHUNK_TARGET, overlap = CHUNK_OVERLAP, title } = options;

  const text = markdown.trim();
  if (!text) return [];

  const sections = splitOnHeadings(text);

  // Merge runt sections forward so a lone heading or one-line section doesn't
  // become its own near-meaningless vector.
  const merged: Section[] = [];
  for (const section of sections) {
    const prev = merged[merged.length - 1];
    if (prev && prev.body.length < MIN_SECTION && prev.body.length + section.body.length <= target) {
      prev.body = [prev.body, section.heading ? `## ${section.heading}` : "", section.body]
        .filter(Boolean)
        .join("\n\n");
    } else {
      merged.push({ ...section });
    }
  }

  const chunks: string[] = [];
  for (const section of merged) {
    const windows = windowSection(section.body.trim(), target, overlap);
    for (const window of windows) {
      const prefix = [title, section.heading].filter(Boolean).join(" › ");
      const body = window.trim();
      if (!body) continue;
      chunks.push(prefix ? `${prefix}\n\n${body}` : body);
    }
  }

  return chunks.filter((c) => c.trim().length > 0);
}
