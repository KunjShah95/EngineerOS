import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";

import { githubAuthorizeUrl } from "@/lib/github";

export async function GET(request: NextRequest) {
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    return NextResponse.json(
      { error: "GitHub integration isn't configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET." },
      { status: 501 }
    );
  }

  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/auth/github/callback`;

  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(githubAuthorizeUrl(redirectUri, state));
  res.cookies.set("gh_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
