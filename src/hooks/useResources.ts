import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import type { Resource, ResourceKind, ResourceWithRelations } from "@/types/database";

export interface ResourceFilters {
  projectId?: string | null;
}

export function resourcesQueryKey(
  workspaceId: string | null,
  kind: ResourceKind | null,
  filters?: ResourceFilters | null
) {
  return ["resources", workspaceId ?? "", kind ?? "", filters ?? null] as const;
}

const resourceSelect =
  "*, project:projects(id, name, color), resource_tags(tag:tags(*))";

export async function fetchResources(
  workspaceId: string,
  kind: ResourceKind,
  filters?: ResourceFilters | null
): Promise<ResourceWithRelations[]> {
  const supabase = createClient();
  let query = supabase
    .from("resources")
    .select(resourceSelect)
    .eq("workspace_id", workspaceId)
    .eq("kind", kind)
    .is("deleted_at", null);

  if (filters?.projectId) {
    query = query.eq("project_id", filters.projectId);
  }

  const { data, error } = await query
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ResourceWithRelations[];
}

export async function fetchResource(resourceId: string): Promise<ResourceWithRelations | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("resources")
    .select(resourceSelect)
    .eq("id", resourceId)
    .maybeSingle();

  if (error) throw error;
  return data as ResourceWithRelations | null;
}

export function useResources(
  workspaceId: string | null,
  kind: ResourceKind | null,
  filters?: ResourceFilters | null
) {
  return useQuery({
    queryKey: resourcesQueryKey(workspaceId, kind, filters),
    queryFn: () => fetchResources(workspaceId!, kind!, filters),
    enabled: Boolean(workspaceId) && Boolean(kind),
  });
}

export function useResource(resourceId: string) {
  return useQuery({
    queryKey: ["resource", resourceId],
    queryFn: () => fetchResource(resourceId),
    enabled: Boolean(resourceId),
  });
}

export interface CreateResourceInput {
  title?: string;
  body_markdown?: string;
  project_id?: string | null;
  metadata?: ResourceWithRelations["metadata"];
  status?: ResourceWithRelations["status"];
}

export function useCreateResource(
  workspaceId: string | null,
  kind: ResourceKind | null,
  filters?: ResourceFilters | null
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateResourceInput) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("resources")
        .insert({
          workspace_id: workspaceId,
          kind,
          title: input.title ?? "Untitled",
          body_markdown: input.body_markdown ?? "",
          project_id: input.project_id ?? null,
          metadata: input.metadata ?? {},
        })
        .select()
        .single();

      if (error) throw error;
      return data as Resource;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: resourcesQueryKey(workspaceId, kind, filters) });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export type ResourcePatch = Partial<
  Pick<Resource, "title" | "body_markdown" | "project_id" | "pinned" | "status"> & {
    metadata: ResourceWithRelations["metadata"];
  }
>;

export function useUpdateResource(resourceId: string, workspaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patch: ResourcePatch) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("resources")
        .update(patch)
        .eq("id", resourceId)
        .select()
        .single();

      if (error) throw error;
      return data as Resource;
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: ["resource", resourceId] });
      const previous = queryClient.getQueryData<ResourceWithRelations | null>(["resource", resourceId]);

      if (previous) {
        queryClient.setQueryData<ResourceWithRelations | null>(["resource", resourceId], {
          ...previous,
          ...patch,
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["resource", resourceId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["resource", resourceId] });
      queryClient.invalidateQueries({ queryKey: ["resources", workspaceId ?? ""] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

/** Soft-delete a resource. */
export function useDeleteResource(resourceId: string, workspaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from("resources")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", resourceId);

      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["resources", workspaceId ?? ""] });
      queryClient.invalidateQueries({ queryKey: ["resource", resourceId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Resource ⇄ tags (many-to-many via resource_tags)
// ---------------------------------------------------------------------------

export function useSetResourceTags(resourceId: string, workspaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tagIds: string[]) => {
      const supabase = createClient();

      const { error: delError } = await supabase
        .from("resource_tags")
        .delete()
        .eq("resource_id", resourceId);
      if (delError) throw delError;

      if (tagIds.length > 0) {
        const { error: insError } = await supabase
          .from("resource_tags")
          .insert(tagIds.map((tag_id) => ({ resource_id: resourceId, tag_id })));
        if (insError) throw insError;
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["resource", resourceId] });
      queryClient.invalidateQueries({ queryKey: ["resources", workspaceId ?? ""] });
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });
}