import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import type { DailyNote } from "@/types/database";

export function dailyNoteQueryKey(workspaceId: string | null, date: string) {
  return ["daily_note", workspaceId ?? "", date] as const;
}

export const DAILY_SECTIONS: {
  key: string;
  label: string;
  hint: string;
  computed?: boolean;
}[] = [
  { key: "morning_goals", label: "Morning Goals", hint: "What do you want to accomplish today?" },
  { key: "journal", label: "Journal", hint: "Free-form thoughts, context, and reflection." },
  { key: "today_tasks", label: "Today's Tasks", hint: "Auto-populated from tasks due today.", computed: true },
  { key: "learned", label: "Learned", hint: "One thing you figured out today." },
  { key: "wins", label: "Wins", hint: "What went well." },
  { key: "problems", label: "Problems", hint: "What blocked you, and what you tried." },
  { key: "tomorrow", label: "Tomorrow", hint: "What's next." },
];

export type DailySectionKey =
  | "morning_goals"
  | "journal"
  | "learned"
  | "wins"
  | "problems"
  | "tomorrow";

/**
 * Idempotent auto-create: upserts against the (workspace_id, date) unique
 * constraint, ignoring duplicates — safe to call on every visit/refresh.
 */
async function getOrCreateDailyNote(workspaceId: string, date: string): Promise<DailyNote> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("daily_notes")
    .upsert(
      { workspace_id: workspaceId, date },
      { onConflict: "workspace_id,date", ignoreDuplicates: true }
    )
    .select()
    .single();

  if (error) throw error;
  return data as DailyNote;
}

export function useDailyNote(workspaceId: string | null, date: string) {
  return useQuery({
    queryKey: dailyNoteQueryKey(workspaceId, date),
    queryFn: () => getOrCreateDailyNote(workspaceId!, date),
    enabled: Boolean(workspaceId) && Boolean(date),
  });
}

export function useUpdateDailyNote(workspaceId: string | null, date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patch: Partial<Pick<DailyNote, DailySectionKey>>) => {
      const supabase = createClient();
      const current = queryClient.getQueryData<DailyNote>(dailyNoteQueryKey(workspaceId, date));
      if (!current) throw new Error("Daily note not loaded");

      const { data, error } = await supabase
        .from("daily_notes")
        .update(patch)
        .eq("id", current.id)
        .select()
        .single();

      if (error) throw error;
      return data as DailyNote;
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: dailyNoteQueryKey(workspaceId, date) });
      const previous = queryClient.getQueryData<DailyNote>(dailyNoteQueryKey(workspaceId, date));
      if (previous) {
        queryClient.setQueryData<DailyNote>(dailyNoteQueryKey(workspaceId, date), {
          ...previous,
          ...patch,
          updated_at: new Date().toISOString(),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(dailyNoteQueryKey(workspaceId, date), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: dailyNoteQueryKey(workspaceId, date) });
    },
  });
}
