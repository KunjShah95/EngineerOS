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
 * Idempotent auto-create: selects the existing note, or inserts it when
 * missing. Implemented as select-then-insert (with a re-read to resolve
 * concurrent-create races) instead of `.upsert({ ignoreDuplicates: true })
 * .select().single()`, which is a known Supabase gotcha — on a re-visit the
 * existing row is treated as an ignored duplicate, zero rows are returned,
 * and `.single()` throws PGRST116, breaking the page on every refresh.
 */
async function getOrCreateDailyNote(workspaceId: string, date: string): Promise<DailyNote> {
  const supabase = createClient();

  // Already exists? Just return it.
  const { data: existing, error: selectError } = await supabase
    .from("daily_notes")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("date", date)
    .maybeSingle();
  if (selectError) throw selectError;
  if (existing) return existing as DailyNote;

  // Missing — create it. Use maybeSingle so a successful insert returns the row.
  const { data: inserted, error: insertError } = await supabase
    .from("daily_notes")
    .insert({ workspace_id: workspaceId, date })
    .select()
    .maybeSingle();
  if (!insertError && inserted) return inserted as DailyNote;

  // The insert may have failed because another request created the row first.
  const { data: raced, error: raceError } = await supabase
    .from("daily_notes")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("date", date)
    .maybeSingle();
  if (raceError) throw raceError;
  if (raced) return raced as DailyNote;

  throw insertError ?? new Error("Failed to create daily note");
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

export function useDailyNotesInRange(workspaceId: string | null, from: string, to: string) {
  return useQuery({
    queryKey: ["daily_notes_range", workspaceId ?? "", from, to] as const,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("daily_notes")
        .select("date")
        .eq("workspace_id", workspaceId)
        .gte("date", from)
        .lte("date", to);

      if (error) throw error;
      return (data ?? []).map((r: { date: string }) => r.date);
    },
    enabled: Boolean(workspaceId) && Boolean(from) && Boolean(to),
  });
}
