import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import { expandEvent } from "@/lib/recurrence";
import type { CalendarEvent } from "@/types/database";

/**
 * Non-deleted events overlapping [fromISO, toISO] (both YYYY-MM-DD).
 * Recurring rows are expanded client-side into concrete instances for the
 * range; instances share the series id and carry an `instanceDate`.
 */
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
        .or(`ends_at.gte.${fromISO}T00:00:00,rrule_freq.not.is.null`)
        .order("starts_at", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as CalendarEvent[];
      return rows
        .flatMap((event) => expandEvent(event, fromISO, toISO))
        // Instances inherit the series' ordering; re-sort by occurrence time
        // so pills within a day render chronologically.
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    },
    enabled: Boolean(workspaceId),
  });
}

export type EventInput = Partial<
  Pick<
    CalendarEvent,
    | "title"
    | "description"
    | "location"
    | "color"
    | "all_day"
    | "starts_at"
    | "ends_at"
    | "rrule_freq"
    | "rrule_interval"
    | "rrule_byday"
    | "rrule_until"
    | "remind_minutes"
  >
>;

/**
 * Keep the event's reminder job in sync: drop any not-yet-fired reminder job
 * for the event, then enqueue a fresh one at `starts_at - remind_minutes` when
 * a reminder is set. Past-fire times are skipped (you can't be reminded about
 * an event that already started). Best-effort — the event write succeeds
 * either way; a failed enqueue just means the reminder won't fire.
 */
async function syncEventReminder(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  event: CalendarEvent,
): Promise<void> {
  // Pending jobs only: a fired job's reminder row is already materialized and
  // can't be unsent. The delete uses the jsonb accessor on the payload, which
  // PostgREST resolves to `payload->>event_id = <id>`. If the delete fails,
  // bail WITHOUT inserting: a stale job firing once at the old time is better
  // than two pending jobs materializing duplicate reminders.
  const { error: deleteError } = await supabase
    .from("jobs")
    .delete()
    .eq("kind", "reminder")
    .eq("status", "pending")
    .eq("payload->>event_id", event.id);
  if (deleteError) return;

  const remind = event.remind_minutes;
  if (!remind || remind <= 0) return;

  const runAt = new Date(new Date(event.starts_at).getTime() - remind * 60_000);
  if (runAt <= new Date()) return; // Event already started — nothing to schedule.

  try {
    await supabase.from("jobs").insert({
      workspace_id: workspaceId,
      kind: "reminder",
      payload: { event_id: event.id, title: event.title },
      run_at: runAt.toISOString(),
    });
  } catch {
    // Best-effort — the reminder just won't fire.
  }
}

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
          rrule_freq: input.rrule_freq ?? null,
          rrule_interval: input.rrule_interval ?? null,
          rrule_byday: input.rrule_byday ?? null,
          rrule_until: input.rrule_until ?? null,
          remind_minutes: input.remind_minutes ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      const event = data as CalendarEvent;
      await syncEventReminder(supabase, workspaceId!, event);
      return event;
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
      const event = data as CalendarEvent;
      // Resync when anything the reminder depends on changed — the reminder
      // itself, the start time (incl. drag-moves, which only send
      // starts_at/ends_at), or the title shown in the notification.
      if (
        patch.remind_minutes !== undefined ||
        patch.starts_at !== undefined ||
        patch.title !== undefined
      ) {
        await syncEventReminder(supabase, workspaceId!, event);
      }
      return event;
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
      // Clear any not-yet-fired reminder job for the event; already-fired
      // reminders cascade away via the reminders.event_id FK on delete.
      await supabase
        .from("jobs")
        .delete()
        .eq("kind", "reminder")
        .eq("status", "pending")
        .eq("payload->>event_id", id);
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
