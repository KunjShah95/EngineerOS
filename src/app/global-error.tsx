"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" data-theme="dark">
      <body className="min-h-full flex flex-col antialiased">
        <main className="flex min-h-screen flex-col items-center justify-center bg-base px-6 py-16 text-foreground">
          <div className="w-full max-w-sm text-center">
            <div className="mx-auto mb-4 inline-flex rounded-md bg-danger/10 p-3">
              <TriangleAlert className="size-6 text-danger" strokeWidth={1.75} />
            </div>
            <h1 className="text-lg font-semibold">Critical error</h1>
            <p className="mt-1.5 text-sm text-secondary">
              The application shell failed to load. Try reloading — if it persists,
              the issue has been logged.
            </p>
            <button
              onClick={reset}
              className="mt-6 inline-flex h-9 items-center justify-center gap-2 rounded-md border border-default bg-surface px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
            >
              <RotateCcw className="size-4" strokeWidth={1.75} />
              Reload
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
