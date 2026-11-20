import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16: Middleware is now called Proxy (functionally identical).
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets, image optimization and the public
     * bot API (/api/mcp, /api/v1), which has no session and must not wait on Supabase.
     */
    "/((?!_next/static|_next/image|favicon.ico|api/mcp|api/v1|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
