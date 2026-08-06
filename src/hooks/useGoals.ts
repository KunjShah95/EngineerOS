import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Goal, GoalStatus } from "@/types/database";

const goalsKey = (workspaceId: string | null) => ["goals", workspaceId ?? ""] as const;

export function useGoals(workspaceId: string | null) {
  return useQuery({
    queryKey: goalsKey(workspaceId),
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("goals")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Goal[];
    },
    enabled: Boolean(workspaceId),
  });
}

export function useCreateGoal(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      description?: string | null;
      target_value?: number | null;
      unit?: string | null;
      due_date?: string | null;
      project_id?: string | null;
    }) => {
      const { data, error } = await createClient()
        .from("goals")
        .insert({ workspace_id: workspaceId, ...input })
        .select()
        .single();
      if (error) throw error;
      return data as Goal;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: goalsKey(workspaceId) }),
  });
}

export function useUpdateGoal(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<Goal, "title" | "description" | "current_value" | "target_value" | "unit" | "due_date" | "status" | "project_id">> }) => {
      const { data, error } = await createClient()
        .from("goals")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Goal;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: goalsKey(workspaceId) }),
  });
}

export function useDeleteGoal(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await createClient()
        .from("goals")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: goalsKey(workspaceId) }),
  });
}
