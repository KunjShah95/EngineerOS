import { Compass } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex h-screen flex-col items-center justify-center gap-3 bg-base px-8 text-center text-foreground">
      <div className="rounded-md bg-accent-muted p-3">
        <Compass className="size-6 text-accent" strokeWidth={1.75} />
      </div>
      <h2 className="text-sm font-medium">404 — Page not found</h2>
      <p className="text-sm text-faint">This route doesn&apos;t exist in EngineerOS.</p>
      <Link href="/dashboard">
        <Button className="mt-2">Back to dashboard</Button>
      </Link>
    </main>
  );
}
