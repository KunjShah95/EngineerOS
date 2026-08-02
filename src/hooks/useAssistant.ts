"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ChatMessage, ChatSource, ChatThread } from "@/types/database";

export function threadsKey(workspaceId: string | null) {
  return ["ai_threads", workspaceId ?? ""] as const;
}

export function messagesKey(threadId: string | null) {
  return ["ai_messages", threadId ?? ""] as const;
}

export interface AssistantReply {
  thread_id: string;
  answer: string;
  model: string;
  local: boolean;
  sources: ChatSource[];
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !json) throw new Error(json?.error ?? "Request failed");
  return json as T;
}

export function useThreads(workspaceId: string | null) {
  return useQuery({
    queryKey: threadsKey(workspaceId),
    queryFn: () => fetchJson<ChatThread[]>("/api/ai/threads"),
    enabled: Boolean(workspaceId),
  });
}

export function useThreadMessages(threadId: string | null) {
  return useQuery({
    queryKey: messagesKey(threadId),
    queryFn: () => fetchJson<ChatMessage[]>(`/api/ai/threads/${threadId}`),
    enabled: Boolean(threadId),
  });
}

export function useAskAssistant(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ threadId, question }: { threadId: string | null; question: string }) =>
      fetchJson<AssistantReply>("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_id: threadId, question }),
      }),
    onSuccess: (reply) => {
      queryClient.invalidateQueries({ queryKey: threadsKey(workspaceId) });
      queryClient.invalidateQueries({ queryKey: messagesKey(reply.thread_id) });
    },
  });
}

export function useCreateThread(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (title?: string) =>
      fetchJson<ChatThread>("/api/ai/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title ?? undefined }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: threadsKey(workspaceId) });
    },
  });
}

export function useDeleteThread(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (threadId: string) =>
      fetchJson<{ ok: boolean }>(`/api/ai/threads/${threadId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: threadsKey(workspaceId) });
    },
  });
}

export function useIndexWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      fetchJson<{ indexed: number; skipped: string | null }>("/api/ai/index", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["semantic"] });
    },
  });
}
