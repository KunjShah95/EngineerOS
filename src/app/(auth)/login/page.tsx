"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { ArrowRight, Terminal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { SetupNotice } from "@/components/supabase/SetupNotice";

const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  if (!isSupabaseConfigured()) {
    return <SetupNotice />;
  }

  const onSubmit = async (values: LoginValues) => {
    setError(null);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (authError) {
      setError(authError.message);
      return;
    }

    const next = new URLSearchParams(window.location.search).get("next");
    queryClient.clear();
    router.push(next || "/dashboard");
    router.refresh();
  };

  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-base px-4 py-10 text-foreground">
      {/* Grid backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border-subtle)_1px,transparent_1px),linear-gradient(to_bottom,var(--border-subtle)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]"
      />
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-72 w-[560px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(79,70,229,0.16),transparent_70%)] blur-3xl"
      />

      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link
            href="/"
            aria-label="EngineerOS home"
            className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#6366f1] to-[#1e40af] shadow-[0_0_24px_-6px_var(--accent)]"
          >
            <Terminal className="size-5 text-white" strokeWidth={2} />
          </Link>
          <h1 className="mt-5 font-display text-2xl font-semibold tracking-tight">
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Log in to your EngineerOS workspace.
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 rounded-2xl border border-default bg-surface/80 p-6 shadow-elevated backdrop-blur-sm"
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              {...register("email")}
            />
            {errors.email ? (
              <p className="text-xs text-danger">{errors.email.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
              {...register("password")}
            />
            {errors.password ? (
              <p className="text-xs text-danger">{errors.password.message}</p>
            ) : null}
          </div>

          {error ? (
            <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Logging in…" : "Log in"}
            {!isSubmitting && <ArrowRight className="size-4" strokeWidth={1.75} />}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-secondary">
          New to EngineerOS?{" "}
          <Link href="/register" className="font-medium text-accent hover:text-accent-hover">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
