import type { NextRequest } from "next/server";

import { knowledgeMap, listTracks } from "@/lib/learn/service";
import { json, limitOrNull, preflight } from "@/lib/mcp/http";

/** The full prerequisite graph. Same data the /map page renders. */
export async function GET(req: NextRequest) {
  const limited = limitOrNull(req);
  if (limited) return limited;
  return json({ tracks: listTracks(), ...knowledgeMap() }, { cache: true });
}

export function OPTIONS() {
  return preflight();
}
