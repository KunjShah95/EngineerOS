import { NextResponse, type NextRequest } from "next/server";

import { safeNextPath } from "@/lib/next-path";
import { createClient } from "@/lib/supabase/server";

/**
 * Complete GitHub OAuth sign-in.
 *
 * Supabase redirects here with `?code=` after the user authorizes on GitHub.
 * The PKCE code verifier is in the cookies set by `signInWithOAuth` (the ssr
 * browser client stores auth state in cookies), so the server client can
 * finish the exchange and set the session cookies in one request. Then honour
 * the validated `next` path — same rules as the email form's `?next=`.
 */
export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  const fail = () =>
    NextResponse.redirect(`${origin}/login?next=${encodeURIComponent(next)}&error=oauth-failed`);

  if (!code) return fail();

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.redirect(`${origin}/login?error=not-configured`);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("OAuth code exchange failed:", error);
    return fail();
  }

  return NextResponse.redirect(`${origin}${next}`);
}
