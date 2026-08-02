import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import type { AutomationRule, AutomationRuleKind, ReminderRow } from "@/types/database";

export function automationRulesKey(workspaceId: string | null) {
  return ["automation_rules", workspaceId ?? ""] as const;
}

export async function fetchAutomationRules(workspaceId: string): Promise<AutomationRule[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("automation_rules")
    .select("*")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AutomationRule[];
}

export function useAutomationRules(workspaceId: string | null) {
  return useQuery({
    queryKey: automationRulesKey(workspaceId),
    queryFn: () => fetchAutomationRules(workspaceId!),
    enabled: Boolean(workspaceId),
  });
}

export function useCreateAutomationRule(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      kind: AutomationRuleKind;
      name: string;
      config: unknown;
    }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("automation_rules")
        .insert({
          workspace_id: workspaceId,
          kind: input.kind,
          name: input.name,
          config: input.config as never,
        })
        .select()
        .single();
      if (error) throw error;
      return data as AutomationRule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: automationRulesKey(workspaceId) });
    },
  });
}

export function useUpdateAutomationRule(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      patch: Partial<Pick<AutomationRule, "name" | "config" | "enabled">>;
    }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("automation_rules")
        .update(input.patch as never)
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return data as AutomationRule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: automationRulesKey(workspaceId) });
    },
  });
}

export function useDeleteAutomationRule(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("automation_rules")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: automationRulesKey(workspaceId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Drain
// ---------------------------------------------------------------------------

export interface DrainSummary {
  recurring_created: number;
  triaged: number;
  rollover_done: boolean;
  reminders_created: number;
  digests_sent: number;
}

export function useAutomationDrain() {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/automation/drain", { method: "POST" });
      const json = (await res.json().catch(() => null)) as (DrainSummary & { error?: string }) | null;
      if (!res.ok || !json) throw new Error(json?.error ?? "Automation run failed");
      return json as DrainSummary;
    },
  });
}

// ---------------------------------------------------------------------------
// Reminders feed (materialized by the drain from reminder jobs)
// ---------------------------------------------------------------------------

export function remindersQueryKey(workspaceId: string | null) {
  return ["reminders", workspaceId ?? ""] as const;
}

export async function fetchReminders(workspaceId: string): Promise<ReminderRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("reminders")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("fire_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ReminderRow[];
}

export function useReminders(workspaceId: string | null) {
  return useQuery({
    queryKey: remindersQueryKey(workspaceId),
    queryFn: () => fetchReminders(workspaceId!),
    enabled: Boolean(workspaceId),
  });
}

export function useMarkReminderRead(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("reminders").update({ read_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: remindersQueryKey(workspaceId) });
    },
  });
}
