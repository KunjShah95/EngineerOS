import type { NextRequest } from "next/server";

import { isLevel, isTrackId, listTopics, search } from "@/lib/learn/service";
import { json, limitOrNull, preflight } from "@/lib/mcp/http";

/** GET /api/v1/topics?track=&level=&q=&limit= */
export async function GET(req: NextRequest) {
  const limited = limitOrNull(req);
  if (limited) return limited;

  const p = req.nextUrl.searchParams;
  const trackRaw = p.get("track");
  const levelRaw = p.get("level");
  if (trackRaw && !isTrackId(trackRaw)) return json({ error: "invalid_track" }, { status: 400 });
  if (levelRaw && !isLevel(levelRaw)) return json({ error: "invalid_level" }, { status: 400 });
  const track = trackRaw && isTrackId(trackRaw) ? trackRaw : undefined;
  const level = levelRaw && isLevel(levelRaw) ? levelRaw : undefined;

  const q = p.get("q")?.trim();
  if (q) {
    const limit = Number(p.get("limit") ?? 8);
    return json({ results: search(q.slice(0, 200), { track, level, limit: Number.isFinite(limit) ? limit : 8 }) }, { cache: true });
  }
  return json({ topics: listTopics({ track, level }) }, { cache: true });
}

export function OPTIONS() {
  return preflight();
}
