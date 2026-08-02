"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import type { SemanticMatch } from "@/types/database";

export interface SemanticResponse {
  mode: "embeddings" | "local-keyword";
  chunks: SemanticMatch[];
}

async function semanticQuery(query: string): Promise<SemanticResponse> {
  const res = await fetch("/api/search/semantic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit: 8 }),
  });
  if (!res.ok) throw new Error("semantic search failed");
  return (await res.json()) as SemanticResponse;
}

/** Plain text corpus item the client-side keyword fallback can score. */
export interface KeywordCorpusItem {
  entity_type: SemanticMatch["entity_type"];
  entity_id: string;
  kind?: string | null;
  date?: string | null;
  text: string;
}

/**
 * Deterministic keyword scorer for the no-Supabase / no-key path. Mirrors the
 * shape of the semantic_search RPC so the palette renders identically either
 * way — it just ranks by shared token frequency over a small client corpus.
 */
export function keywordFallback(query: string, corpus: KeywordCorpusItem[], topK = 8): SemanticMatch[] {
  const qWords = new Set(query.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []);
  const scored = corpus.map((item, i) => {
    const cWords = item.text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
    let hits = 0;
    for (const w of cWords) if (qWords.has(w)) hits += 1;
    return {
      item,
      i,
      score: cWords.length ? hits / Math.max(1, cWords.length) : 0,
    };
  });
  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((x) => ({
      entity_type: x.item.entity_type,
      entity_id: x.item.entity_id,
      chunk_index: 0,
      content: x.item.text.slice(0, 220),
      score: x.score,
      kind: x.item.kind,
      date: x.item.date,
    }));
}

export function useSemanticSearch(
  query: string,
  corpus: KeywordCorpusItem[] = []
): { mode: SemanticResponse["mode"]; chunks: SemanticMatch[]; isPending: boolean } {
  const term = query.trim();

  const { data, isPending } = useQuery({
    queryKey: ["semantic", term],
    queryFn: () => semanticQuery(term),
    enabled: term.length >= 2,
    retry: 0,
    staleTime: 30_000,
  });

  return useMemo(() => {
    // Server answered with real embeddings — use them as-is.
    if (data?.mode === "embeddings" && data.chunks.length > 0) {
      return { mode: "embeddings" as const, chunks: data.chunks, isPending };
    }
    // No live Supabase / no API key — score the client corpus locally so the
    // toggle still feels functional in dev and without credentials.
    const local = keywordFallback(term, corpus);
    return {
      mode: (data?.mode ?? "local-keyword") as SemanticResponse["mode"],
      chunks: local,
      isPending,
    };
  }, [data, isPending, term, corpus]);
}
