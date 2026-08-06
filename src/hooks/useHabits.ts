import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Habit, HabitEntry } from "@/types/database";

const habitsKey = (workspaceId: string | null) => ["habits", workspaceId ?? ""] as const;
const entriesKey = (workspaceId: string | null, from: string, to: string) =>
  ["habit_entries", workspaceId ?? "", from, to] as const;

export function useHabits(workspaceId: string | null) {
  return useQuery({
    queryKey: habitsKey(workspaceId),
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("habits")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Habit[];
    },
    enabled: Boolean(workspaceId),
  });
}

export function useHabitEntries(workspaceId: string | null, from: string, to: string) {
  return useQuery({
    queryKey: entriesKey(workspaceId, from, to),
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("habit_entries")
        .select("*")
        .gte("date", from)
        .lte("date", to);
      if (error) throw error;
      return (data ?? []) as HabitEntry[];
    },
    enabled: Boolean(workspaceId),
  });
}

export function useCreateHabit(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; color?: string | null; frequency?: string }) => {
      const { data, error } = await createClient()
        .from("habits")
        .insert({ workspace_id: workspaceId, ...input })
        .select()
        .single();
      if (error) throw error;
      return data as Habit;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: habitsKey(workspaceId) }),
  });
}

export function useDeleteHabit(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await createClient()
        .from("habits")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: habitsKey(workspaceId) }),
  });
}

export function useToggleHabitEntry(workspaceId: string | null, from: string, to: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ habitId, date, completed }: { habitId: string; date: string; completed: boolean }) => {
      if (completed) {
        const { error } = await createClient()
          .from("habit_entries")
          .upsert({ habit_id: habitId, date, completed: true }, { onConflict: "habit_id,date" });
        if (error) throw error;
      } else {
        const { error } = await createClient()
          .from("habit_entries")
          .delete()
          .eq("habit_id", habitId)
          .eq("date", date);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: entriesKey(workspaceId, from, to) }),
  });
}
