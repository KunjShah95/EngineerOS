import { NextResponse, type NextRequest } from "next/server";

import { CORS_HEADERS, limitOrNull, preflight } from "@/lib/mcp/http";
import { handleMessage, MCP_ERRORS, type JsonRpcResponse } from "@/lib/mcp/server";

/**
 * Remote MCP endpoint (Streamable HTTP, stateless, JSON responses).
 *
 * Connect from Grok (xAI Remote MCP tools), Claude, Cursor or any MCP client:
 *   POST https://<host>/api/mcp
 *
 * Read-only and unauthenticated by design: it serves the public curriculum.
 * Tools that touch a private workspace must not be added here without auth.
 */

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 64 * 1024;
const MAX_BATCH = 20;

const rpcError = (code: number, message: string, status = 400) =>
  NextResponse.json(
    { jsonrpc: "2.0", id: null, error: { code, message } } satisfies JsonRpcResponse,
    { status, headers: CORS_HEADERS }
  );

export async function POST(req: NextRequest) {
  const limited = limitOrNull(req);
  if (limited) return limited;

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return rpcError(MCP_ERRORS.invalidRequest, "Request too large", 413);

  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return rpcError(MCP_ERRORS.invalidRequest, "Request too large", 413);

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return rpcError(MCP_ERRORS.parse, "Parse error");
  }

  if (Array.isArray(payload)) {
    if (payload.length === 0 || payload.length > MAX_BATCH) {
      return rpcError(MCP_ERRORS.invalidRequest, `Batch must contain 1-${MAX_BATCH} messages`);
    }
    const responses = payload.map(handleMessage).filter((r): r is JsonRpcResponse => r !== null);
    if (responses.length === 0) return new NextResponse(null, { status: 202, headers: CORS_HEADERS });
    return NextResponse.json(responses, { headers: CORS_HEADERS });
  }

  const response = handleMessage(payload);
  // Notifications and client responses get 202 Accepted with no body.
  if (response === null) return new NextResponse(null, { status: 202, headers: CORS_HEADERS });
  return NextResponse.json(response, { headers: CORS_HEADERS });
}

// This server never opens an SSE stream and keeps no sessions.
const notAllowed = () =>
  new NextResponse(null, { status: 405, headers: { ...CORS_HEADERS, Allow: "POST, OPTIONS" } });

export const GET = notAllowed;
export const DELETE = notAllowed;

export function OPTIONS() {
  return preflight();
}
