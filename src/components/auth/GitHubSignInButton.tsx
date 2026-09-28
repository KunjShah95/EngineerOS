"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { nextPathFromLocation } from "@/lib/next-path";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

// lucide dropped brand icons, so the GitHub mark lives here as inline SVG.
const GITHUB_MARK =
  "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12";

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d={GITHUB_MARK} />
    </svg>
  );
}

/**
 * Kick off GitHub sign-in through Supabase Auth.
 *
 * This is the *account* OAuth flow (Supabase → GitHub → back), distinct from the
 * workspace GitHub integration under Settings, which uses its own client id and
 * `/api/auth/github/callback`. The PKCE verifier rides in the cookies the ssr
 * browser client sets, so `/auth/callback` can finish the exchange server-side.
 */
export function GitHubSignInButton({ label = "Continue with GitHub" }: { label?: string }) {
  const [error, setError] = useState<string | null>(null);
  const configured = isSupabaseConfigured();

  async function signInWithGitHub() {
    setError(null);
    if (!configured) return;

    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          nextPathFromLocation()
        )}`,
      },
    });
    if (oauthError) setError(oauthError.message);
  }

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={signInWithGitHub}
        disabled={!configured}
      >
        <GitHubMark className="size-4" />
        {label}
      </Button>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}

/** Separate the OAuth button from the email form. */
export function OAuthDivider({ label = "or continue with email" }: { label?: string }) {
  return (
    <div aria-hidden="true">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-default" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-surface/80 px-2 text-faint">{label}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Show why an OAuth callback bounced back to /login.
 *
 * Reads `?error=` during render — the login page is statically prerendered, so
 * this needs a Suspense boundary at the call site (fallback: null).
 */
function OAuthError() {
  const reason = useSearchParams().get("error");

  if (reason === "oauth-failed") {
    return (
      <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
        GitHub sign-in didn&apos;t complete. Please try again.
      </p>
    );
  }
  if (reason === "not-configured") {
    return (
      <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
        Supabase isn&apos;t configured on this deployment — OAuth is unavailable.
      </p>
    );
  }
  return null;
}

export function OAuthErrorNotice() {
  return (
    <Suspense fallback={null}>
      <OAuthError />
    </Suspense>
  );
}
