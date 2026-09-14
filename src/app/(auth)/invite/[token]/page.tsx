"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Mail, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { SetupNotice } from "@/components/supabase/SetupNotice";

/**
 * Invitation landing.
 *
 * Reached from an emailed link (`/invite/<token>`) or a link an owner pasted by
 * hand. The token is the credential, so this page must work for a signed-out
 * visitor — which is why it asks them to sign in or register with `next` pointed
 * back here rather than bouncing them to a dashboard they can't use yet.
 *
 * Accepting on someone's behalf automatically is the wrong default: they need to
 * see which workspace they're joining, and under which email address, before the
 * click that grants access.
 */

type Status =
  | { state: "checking" }
  | { state: "signed-out" }
  | { state: "ready" }
  | { state: "working" }
  | { state: "joined" }
  | { state: "error"; message: string; kind: string };

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  // `isSupabaseConfigured()` reads static env, so it can't change across renders —
  // initialising state from it is deterministic, unlike calling setState in an effect.
  const [status, setStatus] = useState<Status>(() =>
    isSupabaseConfigured()
      ? { state: "checking" }
      : { state: "error", message: "This deployment isn't configured yet.", kind: "config" }
  );

  // `params` is a Promise in this router version, and a client component can't
  // await it during render — so resolve it once and drive the rest from state.
  useEffect(() => {
    void params.then((p) => setToken(p.token));
  }, [params]);

  useEffect(() => {
    if (token === null || !isSupabaseConfigured()) return;
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!cancelled) setStatus(user ? { state: "ready" } : { state: "signed-out" });
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!isSupabaseConfigured()) return <SetupNotice />;

  const accept = async () => {
    if (!token) return;
    setStatus({ state: "working" });
    const res = await fetch("/api/team/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const body = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
    if (!res.ok) {
      setStatus({
        state: "error",
        kind: body?.error ?? "accept-failed",
        message: body?.message ?? "We couldn't accept this invitation.",
      });
      return;
    }
    setStatus({ state: "joined" });
    router.push("/dashboard");
    router.refresh();
  };

  const nextPath = `/invite/${token ?? ""}`;

  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-base px-4 py-10 text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-72 w-[560px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(79,70,229,0.16),transparent_70%)] blur-3xl"
      />
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-5 flex size-11 items-center justify-center rounded-xl bg-accent-muted ring-1 ring-accent/20">
          {status.state === "joined" ? (
            <CheckCircle2 className="size-5 text-accent" strokeWidth={1.75} />
          ) : status.state === "error" ? (
            <ShieldAlert className="size-5 text-warning" strokeWidth={1.75} />
          ) : (
            <Mail className="size-5 text-accent" strokeWidth={1.75} />
          )}
        </div>

        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {status.state === "joined"
            ? "You're in"
            : status.state === "error"
              ? "Invitation unavailable"
              : "You've been invited"}
        </h1>

        <p className="mt-2 text-sm leading-relaxed text-secondary">
          {status.state === "checking" && "Checking your session…"}
          {status.state === "signed-out" &&
            "Sign in or create an account to accept this invitation and open the workspace."}
          {status.state === "ready" &&
            "Accept to join the workspace. You can switch between workspaces any time from the sidebar."}
          {status.state === "working" && "Adding you to the workspace…"}
          {status.state === "joined" && "Taking you to your new workspace."}
          {status.state === "error" && status.message}
        </p>

        {status.state === "error" && status.kind === "email-mismatch" && (
          <p className="mt-3 text-xs text-faint">
            This invitation was sent to a different address. Sign in with that
            address, or ask the owner to re-invite you.
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2">
          {status.state === "ready" && (
            <Button onClick={() => void accept()} className="w-full">
              Accept invitation
              <ArrowRight className="size-4" strokeWidth={1.75} />
            </Button>
          )}

          {status.state === "signed-out" && (
            <>
              <Button asChild className="w-full">
                <Link href={`/register?next=${encodeURIComponent(nextPath)}`}>Create an account</Link>
              </Button>
              <Button variant="secondary" asChild className="w-full">
                <Link href={`/login?next=${encodeURIComponent(nextPath)}`}>I already have one</Link>
              </Button>
            </>
          )}

          {status.state === "error" && (
            <Button variant="secondary" asChild className="w-full">
              <Link href="/">Back to home</Link>
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}
