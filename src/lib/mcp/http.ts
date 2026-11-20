import { NextResponse, type NextRequest } from "next/server";

import { createLimiter } from "./rate-limit";

/** Public, read-only, unauthenticated data: any origin may read it. */
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Accept, Authorization, Mcp-Protocol-Version, Mcp-Session-Id",
  "Access-Control-Expose-Headers": "Retry-After",
  "Access-Control-Max-Age": "86400",
};

// ~120 requests/minute sustained per client, bursts up to 40.
const limiter = createLimiter({ capacity: 40, refillPerSecond: 2 });

export function clientKey(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "anonymous").slice(0, 64);
}

/** Returns a 429 response when the caller is over the limit, otherwise null. */
export function limitOrNull(req: NextRequest): NextResponse | null {
  const r = limiter.take(clientKey(req));
  if (r.allowed) return null;
  return NextResponse.json(
    { error: "rate_limited", message: "Too many requests. Slow down and retry.", retryAfterSeconds: r.retryAfterSeconds },
    { status: 429, headers: { ...CORS_HEADERS, "Retry-After": String(r.retryAfterSeconds) } }
  );
}

export function json(data: unknown, init: { status?: number; cache?: boolean } = {}): NextResponse {
  return NextResponse.json(data, {
    status: init.status ?? 200,
    headers: {
      ...CORS_HEADERS,
      ...(init.cache ? { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } : {}),
    },
  });
}

export function preflight(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
