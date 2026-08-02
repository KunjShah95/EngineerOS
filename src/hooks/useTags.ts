import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import type { Tag, TagWithUsage } from "@/types/database";

export function tagsQueryKey(workspaceId: string | null) {
  return ["tags", workspaceId ?? ""] as const;
}

export async function fetchTags(workspaceId: string): Promise<TagWithUsage[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tags")
    .select("*, notes(count), tasks(count)")
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as TagWithUsage[];
}

export function useTags(workspaceId: string | null) {
  return useQuery({
    queryKey: tagsQueryKey(workspaceId),
    queryFn: () => fetchTags(workspaceId!),
    enabled: Boolean(workspaceId),
  });
}

export function useCreateTag(workspaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      name,
      color,
    }: {
      name: string;
      color?: string | null;
    }): Promise<Tag> => {
      const supabase = createClient();
      const trimmed = name.trim();
      const { data, error } = await supabase
        .from("tags")
        .upsert(
          { workspace_id: workspaceId, name: trimmed, color: color ?? null },
          { onConflict: "workspace_id,name", ignoreDuplicates: true }
        )
        .select()
        .single();

      if (error) throw error;
      return data as Tag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagsQueryKey(workspaceId) });
    },
  });
}

/**
 * Resolve a list of tag names to tag ids, creating any that don't exist yet.
 * Used by tag inputs so users can type free-form tags.
 */
export async function getOrCreateTagIds(
  workspaceId: string,
  names: string[]
): Promise<string[]> {
  const supabase = createClient();
  const trimmed = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (trimmed.length === 0) return [];

  const { data: existing, error: selError } = await supabase
    .from("tags")
    .select("id, name")
    .eq("workspace_id", workspaceId)
    .in("name", trimmed);
  if (selError) throw selError;

  const existingByName = new Map(
    (existing ?? []).map((t: { id: string; name: string }) => [t.name, t.id])
  );
  const ids: string[] = [];
  const toCreate: { workspace_id: string; name: string }[] = [];

  for (const name of trimmed) {
    const found = existingByName.get(name);
    if (found) ids.push(found);
    else toCreate.push({ workspace_id: workspaceId, name });
  }

  if (toCreate.length > 0) {
    const { data: created, error: insError } = await supabase
      .from("tags")
      .insert(toCreate)
      .select("id, name");
    if (insError) throw insError;
    for (const t of created ?? []) ids.push((t as { id: string }).id);
  }

  return ids;
}
