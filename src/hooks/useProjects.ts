import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import type { Project, ProjectStatus, ProjectWithCounts } from "@/types/database";

export function projectsQueryKey(workspaceId: string | null) {
  return ["projects", workspaceId ?? ""] as const;
}

export async function fetchProjects(workspaceId: string): Promise<ProjectWithCounts[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*, tasks(count), notes(count)")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ProjectWithCounts[];
}

export async function fetchProject(projectId: string): Promise<ProjectWithCounts | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*, tasks(count), notes(count)")
    .eq("id", projectId)
    .maybeSingle();

  if (error) throw error;
  return data as ProjectWithCounts | null;
}

export function useProjects(workspaceId: string | null) {
  return useQuery({
    queryKey: projectsQueryKey(workspaceId),
    queryFn: () => fetchProjects(workspaceId!),
    enabled: Boolean(workspaceId),
  });
}

export interface ProjectInput {
  name: string;
  description?: string | null;
  color?: string | null;
  status?: ProjectStatus;
}

export function useCreateProject(workspaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ProjectInput) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("projects")
        .insert({
          workspace_id: workspaceId,
          name: input.name,
          description: input.description ?? null,
          color: input.color ?? null,
          status: input.status ?? "active",
        })
        .select()
        .single();

      if (error) throw error;
      return data as Project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsQueryKey(workspaceId) });
    },
  });
}

export function useUpdateProject(workspaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Pick<Project, "name" | "description" | "color" | "status">>;
    }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("projects")
        .update(patch)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as Project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsQueryKey(workspaceId) });
    },
  });
}

/** Soft-delete (sets deleted_at) — nothing hard-deletes in V1. */
export function useDeleteProject(workspaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("projects")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsQueryKey(workspaceId) });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });
}
