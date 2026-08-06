import type { Supabase } from "@/lib/supabase/auth";
import type { AiRuntimeConfig } from "@/lib/ai/server-config";

export interface VoiceRuntimeConfig {
  provider: string;      // 'openai' | 'sarvam' | 'elevenlabs' | 'kokoro'
  apiKey: string | null;
  speaker: string;
  languageCode: string;
  isDefault: boolean;
}

/** Load all configured voice TTS providers for the workspace. */
export async function loadVoiceTtsConfigs(
  supabase: Supabase,
  workspaceId: string
): Promise<VoiceRuntimeConfig[]> {
  const { data, error } = await supabase
    .from("voice_tts_configs")
    .select("provider, api_key, speaker, language_code, is_default")
    .eq("workspace_id", workspaceId)
    .order("is_default", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => ({
    provider: row.provider as string,
    apiKey: (row as Record<string, unknown>).api_key as string | null,
    speaker: (row as Record<string, unknown>).speaker as string ?? "nova",
    languageCode: (row as Record<string, unknown>).language_code as string ?? "en-IN",
    isDefault: (row as Record<string, unknown>).is_default as boolean ?? false,
  }));
}

/** Load the active (default or specified) voice TTS config. */
export async function loadVoiceTtsConfig(
  supabase: Supabase,
  workspaceId: string,
  provider?: string
): Promise<VoiceRuntimeConfig | null> {
  const all = await loadVoiceTtsConfigs(supabase, workspaceId);
  if (!all.length) return null;
  if (provider) return all.find((c) => c.provider === provider) ?? null;
  return all.find((c) => c.isDefault) ?? all[0] ?? null;
}

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
