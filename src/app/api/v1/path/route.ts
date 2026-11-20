import type { NextRequest } from "next/server";

import { learningPath, nextTopics } from "@/lib/learn/service";
import { json, limitOrNull, preflight } from "@/lib/mcp/http";

/**
 * GET /api/v1/path?to=<topic-id>            study order to reach a topic
 * GET /api/v1/path?completed=a,b,c          topics you can start now
 */
export async function GET(req: NextRequest) {
  const limited = limitOrNull(req);
  if (limited) return limited;

  const p = req.nextUrl.searchParams;
  const to = p.get("to");
  if (to) {
    const path = learningPath(to.slice(0, 100));
    return path ? json(path, { cache: true }) : json({ error: "not_found" }, { status: 404 });
  }
  const completed = p.get("completed");
  if (completed !== null) {
    const ids = completed.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 200);
    return json(nextTopics(ids));
  }
  return json({ error: "bad_request", message: "Pass ?to=<topic-id> or ?completed=<ids>" }, { status: 400 });
}

export function OPTIONS() {
  return preflight();
}
