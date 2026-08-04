import { NextResponse } from "next/server";

import { requireWorkspace } from "@/lib/supabase/auth";
import { listProviders, resolveProvider } from "@/lib/ai/providers";
import { loadAiConfig } from "@/lib/ai/db-config";
import { runWithAiConfig } from "@/lib/ai/server-config";

export async function GET() {
  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  const saved = await loadAiConfig(supabase, workspace.id);
  const result = runWithAiConfig(saved, () => {
    if (!saved) return null;
    try {
      const provider = resolveProvider(saved.provider);
      return provider.isConfigured() ? provider : null;
    } catch {
      return null;
    }
  });

  return NextResponse.json({
    configured: Boolean(result),
    provider: result?.name ?? null,
    providerName: result?.displayName ?? null,
    models: result
      ? {
          chat: result.name,
          embedding: result.name,
          transcription: result.name,
        }
      : null,
    providers: listProviders(),
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    provider?: string;
    apiKey?: string;
  } | null;
  if (!body?.provider || !body?.apiKey) {
    return NextResponse.json({ error: "provider and apiKey are required" }, { status: 400 });
  }

  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  // Validate the provider name before persisting.
  const valid = listProviders().some((p) => p.name === body.provider);
  if (!valid) {
    return NextResponse.json({ error: "unknown provider" }, { status: 400 });
  }

  const { error } = await supabase
    .from("ai_configs")
    .upsert(
      { workspace_id: workspace.id, provider: body.provider, api_key: body.apiKey.trim() },
      { onConflict: "workspace_id" }
    );
  if (error) {
    return NextResponse.json({ error: "save-failed" }, { status: 500 });
  }

  const saved = { provider: body.provider, apiKey: body.apiKey.trim() };
  const provider = runWithAiConfig(saved, () => resolveProvider(body.provider));

  return NextResponse.json({
    configured: provider.isConfigured(),
    provider: provider.name,
    providerName: provider.displayName,
  });
}
