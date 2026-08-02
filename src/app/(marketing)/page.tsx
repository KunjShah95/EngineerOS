import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-base px-8 text-center text-foreground">
      <p className="text-sm font-medium tracking-wide text-accent">EngineerOS</p>
      <h1 className="max-w-2xl text-[32px] font-semibold leading-10">
        One connected system for notes, tasks, projects, and daily work.
      </h1>
      <p className="max-w-md text-sm text-secondary">
        Capture everything. Find everything. Organize everything.
      </p>
      <div className="flex items-center gap-3">
        <Link href="/register">
          <Button>
            Get started <ArrowRight className="size-4" strokeWidth={1.75} />
          </Button>
        </Link>
        <Link href="/login">
          <Button variant="secondary">Log in</Button>
        </Link>
      </div>
    </main>
  );
}
