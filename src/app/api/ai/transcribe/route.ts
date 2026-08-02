import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { transcribeAudio } from "@/lib/ai";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { storage_path?: string } | null;
  if (!body?.storage_path) return NextResponse.json({ error: "missing storage_path" }, { status: 400 });

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "not-configured" }, { status: 501 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Storage paths are namespaced as <workspace_id>/<file>. Reject anything
  // that doesn't match the user's own workspace (defense in depth on top of
  // the bucket policy, which already scopes reads to auth.uid()).
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (!workspace) return NextResponse.json({ error: "no-workspace" }, { status: 400 });

  if (!body.storage_path.startsWith(`${workspace.id}/`)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Load the audio from storage.
  const { data, error } = await supabase.storage.from("voice-notes").download(body.storage_path);
  if (error || !data) return NextResponse.json({ error: "audio-not-found" }, { status: 404 });

  const filename = body.storage_path.split("/").pop() ?? "voice.webm";
  const mime = filename.endsWith(".ogg") ? "audio/ogg" : "audio/webm";

  try {
    const result = await transcribeAudio(Buffer.from(await data.arrayBuffer()), filename, mime);
    return NextResponse.json({ transcript: result?.transcript ?? null, model: result?.model ?? null });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
