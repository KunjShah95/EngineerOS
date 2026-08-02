import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/supabase/config";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/projects",
  "/notes",
  "/tasks",
  "/daily",
  "/mindmap",
  "/pdf-chat",
  "/voice",
  "/settings",
];

const AUTH_ROUTES = ["/login", "/register"];

export async function updateSession(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    // No credentials yet — let everything through so the UI can show setup
    // guidance instead of crashing on a redirect loop.
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: no logic between createServerClient and getUser().
  let user = null;
  try {
    const {
      data: { user: sessionUser },
    } = await supabase.auth.getUser();
    user = sessionUser;
  } catch {
    // Supabase unreachable (outage/network) — fail open instead of 500ing
    // every request; the client surfaces its own error states.
    return supabaseResponse;
  }

  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (!user && isProtected && !AUTH_ROUTES.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && AUTH_ROUTES.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
