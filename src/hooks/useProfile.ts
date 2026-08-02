import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Profile } from "@/types/database";

export const profileQueryKey = ["profile"] as const;

async function fetchProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data as Profile | null;
}

export function useProfile() {
  return useQuery({
    queryKey: profileQueryKey,
    queryFn: fetchProfile,
    enabled: isSupabaseConfigured(),
    retry: false,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patch: Partial<Pick<Profile, "display_name" | "avatar_url">>) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("users")
        .update(patch)
        .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "")
        .select()
        .single();

      if (error) throw error;
      return data as Profile;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<Profile | null>(profileQueryKey, (old) =>
        old ? { ...old, ...updated } : updated
      );
    },
  });
}
