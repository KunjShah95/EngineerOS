"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { ArrowRight, MailCheck, Terminal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { SetupNotice } from "@/components/supabase/SetupNotice";

const registerSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type RegisterValues = z.infer<typeof registerSchema>;

function AuthShell({ children }: { children: React.ReactNode }) {
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
      {children}
    </main>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });

  if (!isSupabaseConfigured()) {
    return <SetupNotice />;
  }

  if (confirmSent) {
    return (
      <AuthShell>
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-5 flex size-11 items-center justify-center rounded-xl bg-accent-muted ring-1 ring-accent/20">
            <MailCheck className="size-5 text-accent" strokeWidth={1.75} />
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Check your email
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-secondary">
            We sent a confirmation link to{" "}
            <span className="font-medium text-foreground">{confirmSent}</span>.
            Click it to finish creating your account, then log in.
          </p>
          <div className="mt-6">
            <Link href="/login" className="text-sm font-medium text-accent hover:text-accent-hover">
              Back to login
            </Link>
          </div>
        </div>
      </AuthShell>
    );
  }

  const onSubmit = async (values: RegisterValues) => {
    setError(null);
    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
    });

    if (authError) {
      setError(authError.message);
      return;
    }

    if (data.session) {
      // Email confirmation disabled — session already exists, head to the app.
      queryClient.clear();
      router.push("/dashboard");
      router.refresh();
    } else {
      // Confirmation email required.
      setConfirmSent(values.email);
    }
  };

  return (
    <AuthShell>
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
            Create your account
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Your workspace is created automatically.
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
              placeholder="At least 8 characters"
              autoComplete="new-password"
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
            {isSubmitting ? "Creating account…" : "Create account"}
            {!isSubmitting && <ArrowRight className="size-4" strokeWidth={1.75} />}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-secondary">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-accent hover:text-accent-hover">
            Log in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
