import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import type { CalendarEvent } from "@/types/database";

/** Non-deleted events overlapping [fromISO, toISO] (both YYYY-MM-DD). */
export function useEvents(workspaceId: string | null, fromISO: string, toISO: string) {
  return useQuery({
    queryKey: ["events", workspaceId ?? "", fromISO, toISO],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .is("deleted_at", null)
        .lte("starts_at", `${toISO}T23:59:59`)
        .gte("ends_at", `${fromISO}T00:00:00`)
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CalendarEvent[];
    },
    enabled: Boolean(workspaceId),
  });
}

export type EventInput = Partial<
  Pick<
    CalendarEvent,
    "title" | "description" | "location" | "color" | "all_day" | "starts_at" | "ends_at"
  >
>;

export function useCreateEvent(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: EventInput) => {
      const supabase = createClient();
      const now = new Date();
      const oneHour = new Date(now.getTime() + 60 * 60 * 1000);
      const { data, error } = await supabase
        .from("events")
        .insert({
          workspace_id: workspaceId,
          title: input.title ?? "New event",
          description: input.description ?? "",
          location: input.location ?? null,
          color: input.color ?? "blue",
          all_day: input.all_day ?? false,
          starts_at: input.starts_at ?? now.toISOString(),
          ends_at: input.ends_at ?? oneHour.toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      return data as CalendarEvent;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["events", workspaceId ?? ""] });
    },
  });
}

export function useUpdateEvent(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: EventInput }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("events")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as CalendarEvent;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["events", workspaceId ?? ""] });
    },
  });
}

export function useDeleteEvent(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("events")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["events", workspaceId ?? ""] });
    },
  });
}
