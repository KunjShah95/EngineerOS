import { useQuery } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Workspace } from "@/types/database";

export const workspaceQueryKey = ["workspace"] as const;

async function fetchWorkspace(): Promise<Workspace | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("workspaces")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as Workspace | null;
}

/** Resolves the user's (single) workspace. Null when signed out or not set up. */
export function useWorkspace() {
  return useQuery({
    queryKey: workspaceQueryKey,
    queryFn: fetchWorkspace,
    enabled: isSupabaseConfigured(),
    retry: false,
  });
}
