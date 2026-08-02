"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The Sentry browser SDK picks this up automatically when configured.
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center bg-base px-6 py-16 text-foreground">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-4 inline-flex rounded-md bg-danger/10 p-3">
          <TriangleAlert className="size-6 text-danger" strokeWidth={1.75} />
        </div>
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-1.5 text-sm text-secondary">
          This page hit an unexpected error. It&apos;s been logged — try again, or
          head back to your dashboard.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-xs text-faint">digest: {error.digest}</p>
        ) : null}

        <div className="mt-6 flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="size-4" strokeWidth={1.75} />
            Try again
          </Button>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
