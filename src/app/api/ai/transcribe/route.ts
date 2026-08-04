import { NextResponse, type NextRequest } from "next/server";

import { requireWorkspace } from "@/lib/supabase/auth";
import { transcribeAudio } from "@/lib/ai";
import { loadAiConfig } from "@/lib/ai/db-config";
import { runWithAiConfig } from "@/lib/ai/server-config";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { storage_path?: string } | null;
  if (!body?.storage_path) return NextResponse.json({ error: "missing storage_path" }, { status: 400 });

  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, user, workspace } = auth;

  // Storage paths are namespaced as <user_id>/<file>. The bucket policy also
  // enforces auth.uid() as the first path segment, so this is defense in depth.
  if (!body.storage_path.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Load the audio from storage.
  const { data, error } = await supabase.storage.from("voice-notes").download(body.storage_path);
  if (error || !data) return NextResponse.json({ error: "audio-not-found" }, { status: 404 });

  const filename = body.storage_path.split("/").pop() ?? "voice.webm";
  const mime = filename.endsWith(".ogg") ? "audio/ogg" : "audio/webm";

  try {
    const aiConfig = await loadAiConfig(supabase, workspace.id);
    const result = await runWithAiConfig(aiConfig, async () =>
      transcribeAudio(Buffer.from(await data.arrayBuffer()), filename, mime)
    );
    return NextResponse.json({ transcript: result?.transcript ?? null, model: result?.model ?? null });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
