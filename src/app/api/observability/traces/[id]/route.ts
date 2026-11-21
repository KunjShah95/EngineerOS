import { NextResponse, type NextRequest } from "next/server";

import { getTrace } from "@/lib/observability/trace-store";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trace = getTrace(id);
  if (!trace) return NextResponse.json({ error: "not-found" }, { status: 404 });
  return NextResponse.json({ trace });
}