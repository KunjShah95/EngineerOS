import { NextResponse } from "next/server";

import { listTraces } from "@/lib/observability/trace-store";

export async function GET() {
  const traces = listTraces(50).map((t) => ({
    id: t.id,
    question: t.question,
    startedAt: t.startedAt,
    durationMs: t.durationMs,
    metadata: t.metadata,
  }));
  return NextResponse.json({ traces });
}