import { useQuery } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import type { Note, Project, Tag, Task } from "@/types/database";

export interface SearchResults {
  notes: Note[];
  tasks: Task[];
  projects: Project[];
  tags: Tag[];
}

async function searchAll(workspaceId: string, query: string): Promise<SearchResults> {
  const supabase = createClient();
  const term = query.trim();
  if (!term) return { notes: [], tasks: [], projects: [], tags: [] };

  const like = `%${term}%`;

  const [notes, tasks, projects, tags] = await Promise.all([
    supabase
      .from("notes")
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .or(`title.ilike.${like},body_markdown.ilike.${like}`)
      .order("updated_at", { ascending: false })
      .limit(6),
    supabase
      .from("tasks")
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .or(`title.ilike.${like},description.ilike.${like}`)
      .order("updated_at", { ascending: false })
      .limit(6),
    supabase
      .from("projects")
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .or(`name.ilike.${like},description.ilike.${like}`)
      .order("updated_at", { ascending: false })
      .limit(4),
    supabase
      .from("tags")
      .select("*")
      .eq("workspace_id", workspaceId)
      .ilike("name", like)
      .limit(4),
  ]);

  return {
    notes: (notes.data ?? []) as Note[],
    tasks: (tasks.data ?? []) as Task[],
    projects: (projects.data ?? []) as Project[],
    tags: (tags.data ?? []) as Tag[],
  };
}

export function useSearch(workspaceId: string | null, query: string) {
  const term = query.trim();

  return useQuery({
    queryKey: ["search", workspaceId ?? "", term],
    queryFn: () => searchAll(workspaceId!, term),
    enabled: Boolean(workspaceId) && term.length > 0,
  });
}
