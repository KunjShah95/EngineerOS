import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import type { CaptureType, QuickCapture } from "@/types/database";

export function capturesQueryKey(workspaceId: string | null) {
  return ["quick_captures", workspaceId ?? ""] as const;
}

async function fetchCaptures(workspaceId: string): Promise<QuickCapture[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("quick_captures")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as QuickCapture[];
}

export function useCaptures(workspaceId: string | null) {
  return useQuery({
    queryKey: capturesQueryKey(workspaceId),
    queryFn: () => fetchCaptures(workspaceId!),
    enabled: Boolean(workspaceId),
  });
}

export interface CaptureInput {
  raw_text: string;
  /** Immediately triage into a real entity. null keeps it in the inbox. */
  triageInto?: CaptureType;
  /** Optional destination for the triaged entity. */
  project_id?: string | null;
  status?: "backlog" | "todo" | "in_progress";
}

export function useCreateCapture(workspaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CaptureInput) => {
      const supabase = createClient();
      const text = input.raw_text.trim();
      if (!text) throw new Error("Capture text is empty");

      // 1. Always write to the inbox table first.
      const { data: capture, error: capError } = await supabase
        .from("quick_captures")
        .insert({ workspace_id: workspaceId, raw_text: text })
        .select()
        .single();
      if (capError) throw capError;

      // 2. Triage into a real note or task and stamp the join.
      if (input.triageInto === "note") {
        const { data: note, error: noteError } = await supabase
          .from("notes")
          .insert({
            workspace_id: workspaceId,
            title: text.length > 80 ? `${text.slice(0, 80)}…` : text,
            body_markdown: "",
            project_id: input.project_id ?? null,
          })
          .select()
          .single();
        if (noteError) throw noteError;

        const { error: stampError } = await supabase
          .from("quick_captures")
          .update({ triaged_into: "note", triaged_id: note.id })
          .eq("id", capture.id);
        if (stampError) throw stampError;
        return note;
      }

      if (input.triageInto === "task") {
        const { data: task, error: taskError } = await supabase
          .from("tasks")
          .insert({
            workspace_id: workspaceId,
            title: text,
            status: input.status ?? "todo",
            project_id: input.project_id ?? null,
            position: 0,
          })
          .select()
          .single();
        if (taskError) throw taskError;

        const { error: stampError } = await supabase
          .from("quick_captures")
          .update({ triaged_into: "task", triaged_id: task.id })
          .eq("id", capture.id);
        if (stampError) throw stampError;
        return task;
      }

      return capture;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: capturesQueryKey(workspaceId) });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
