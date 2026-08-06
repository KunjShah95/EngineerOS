import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import type { Snippet } from "@/types/database";

export function useSnippets(workspaceId: string | null) {
  return useQuery({
    queryKey: ["snippets", workspaceId ?? ""],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("snippets")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Snippet[];
    },
    enabled: Boolean(workspaceId),
  });
}

export type SnippetInput = Partial<Pick<Snippet, "title" | "body" | "language" | "tags">>;

export function useCreateSnippet(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SnippetInput) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("snippets")
        .insert({
          workspace_id: workspaceId,
          title: input.title ?? "Untitled snippet",
          body: input.body ?? "",
          language: input.language ?? "plaintext",
          tags: input.tags ?? [],
        })
        .select()
        .single();
      if (error) throw error;
      return data as Snippet;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["snippets", workspaceId ?? ""] });
    },
  });
}

export function useUpdateSnippet(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: SnippetInput }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("snippets")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Snippet;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["snippets", workspaceId ?? ""] });
    },
  });
}

export function useDeleteSnippet(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("snippets")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["snippets", workspaceId ?? ""] });
    },
  });
}
