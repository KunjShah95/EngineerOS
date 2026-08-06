import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import type { Contact } from "@/types/database";

export function useContacts(workspaceId: string | null) {
  return useQuery({
    queryKey: ["contacts", workspaceId ?? ""],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .is("deleted_at", null)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Contact[];
    },
    enabled: Boolean(workspaceId),
  });
}

export type ContactInput = Partial<Pick<Contact, "name" | "email" | "role" | "company" | "notes_markdown">>;

export function useCreateContact(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ContactInput) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("contacts")
        .insert({
          workspace_id: workspaceId,
          name: input.name ?? "New Contact",
          email: input.email ?? null,
          role: input.role ?? null,
          company: input.company ?? null,
          notes_markdown: input.notes_markdown ?? "",
        })
        .select()
        .single();
      if (error) throw error;
      return data as Contact;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts", workspaceId ?? ""] });
    },
  });
}

export function useUpdateContact(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: ContactInput }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("contacts")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Contact;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts", workspaceId ?? ""] });
    },
  });
}

export function useDeleteContact(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("contacts")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts", workspaceId ?? ""] });
    },
  });
}
