"use client";

import { useQuery } from "@tanstack/react-query";

import type { SemanticMatch } from "@/types/database";

export interface SemanticResponse {
  mode: "embeddings" | "local-keyword" | "error";
  chunks: SemanticMatch[];
}

async function semanticQuery(workspaceId: string, query: string): Promise<SemanticResponse> {
  const res = await fetch("/api/search/semantic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit: 8 }),
  });
  if (!res.ok) throw new Error("semantic search failed");
  const json = (await res.json()) as SemanticResponse;
  return json;
}

export function useSemanticSearch(workspaceId: string | null, query: string) {
  const term = query.trim();
  return useQuery({
    queryKey: ["semantic", workspaceId ?? "", term],
    queryFn: () => semanticQuery(workspaceId!, term),
    enabled: Boolean(workspaceId) && term.length >= 2,
    retry: 0,
    staleTime: 60_000,
  });
}