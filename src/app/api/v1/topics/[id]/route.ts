import type { NextRequest } from "next/server";

import { getTopicDetail } from "@/lib/learn/service";
import { json, limitOrNull, preflight } from "@/lib/mcp/http";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const limited = limitOrNull(req);
  if (limited) return limited;
  const { id } = await ctx.params;
  const topic = getTopicDetail(id.slice(0, 100));
  if (!topic) return json({ error: "not_found", message: `No topic "${id.slice(0, 100)}"` }, { status: 404 });
  return json(topic, { cache: true });
}

export function OPTIONS() {
  return preflight();
}
