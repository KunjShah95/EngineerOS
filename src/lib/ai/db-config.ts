import type { Supabase } from "@/lib/supabase/auth";
import type { AiRuntimeConfig } from "@/lib/ai/server-config";

/**
 * Load the workspace's persisted BYOK AI config (provider + API key) from the
 * `ai_configs` table. Returns null when the owner hasn't saved one yet, so
 * callers fall through to the env-var providers.
 */
export async function loadAiConfig(
  supabase: Supabase,
  workspaceId: string
): Promise<AiRuntimeConfig | null> {
  const { data, error } = await supabase
    .from("ai_configs")
    .select("provider, api_key, base_url")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  // The migration may not be applied yet (fresh deploy / unlinked project).
  // Treat a missing table as "no BYOK config" so AI keeps working off env vars.
  if (error || !data?.provider || !data.api_key) return null;
  return { provider: data.provider, apiKey: data.api_key, baseUrl: (data as Record<string, unknown>).base_url as string | undefined };
}
