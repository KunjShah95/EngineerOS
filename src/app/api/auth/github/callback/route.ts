import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForToken, fetchGitHubUser } from "@/lib/github";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.cookies.get("gh_oauth_state")?.value;
  const origin = url.origin;

  const fail = (reason: string) => {
    const res = NextResponse.redirect(`${origin}/settings?gh=error&reason=${encodeURIComponent(reason)}`);
    res.cookies.set("gh_oauth_state", "", { maxAge: 0, path: "/" });
    return res;
  };

  if (!code || !state || !cookieState || state !== cookieState) {
    return fail("state-mismatch");
  }

  try {
    const { access_token } = await exchangeCodeForToken(code, `${origin}/api/auth/github/callback`);
    const ghUser = await fetchGitHubUser(access_token);

    const supabase = await createClient();
    if (!supabase) return fail("not-configured");

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return fail("not-authed");

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id")
      .eq("owner_id", user.id)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    if (!workspace) return fail("no-workspace");

    const { error } = await supabase.from("integrations").upsert(
      {
        workspace_id: workspace.id,
        provider: "github",
        provider_user_id: String(ghUser.id),
        username: ghUser.login,
        avatar_url: ghUser.avatar_url,
        access_token,
        scopes: ["repo", "read:user"],
      },
      { onConflict: "workspace_id,provider" }
    );
    if (error) throw error;

    const res = NextResponse.redirect(`${origin}/settings?gh=connected`);
    res.cookies.set("gh_oauth_state", "", { maxAge: 0, path: "/" });
    return res;
  } catch (err) {
    console.error("GitHub OAuth callback failed:", err);
    return fail("exchange-failed");
  }
}
