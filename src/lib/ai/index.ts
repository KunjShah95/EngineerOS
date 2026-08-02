// Aggregation module — keeps src/lib/ai.ts intact and adds Phase 8a index
// helpers on top. Re-export the original API + embeddings for drop-in imports.

export * from "../ai";
export * from "./embeddings";

import { chunkText } from "../ai";

export function chunkForEmbedding(text: string, size = 1400, overlap = 200): string[] {
  return chunkText(text, size, overlap);
}

// Best-effort vector scorer used when the embeddings table isn't reachable
// (no live Supabase). Scores chunks by shared token frequency, mirroring the
// shape of semantic_search() so the UI code is provider-agnostic.
export function retrieveByKeyword(question: string, chunks: string[], topK = 8): { content: string; score: number }[] {
  const qWords = new Set(question.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []);
  return chunks
    .map((c) => {
      const cWords = c.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
      let hits = 0;
      for (const w of cWords) if (qWords.has(w)) hits += 1;
      return { content: c, score: cWords.length ? hits / Math.max(1, cWords.length) : 0 };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
