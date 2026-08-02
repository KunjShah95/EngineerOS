import { Database, ExternalLink, KeyRound } from "lucide-react";
import Link from "next/link";

const steps = [
  {
    icon: Database,
    title: "Create a Supabase project",
    body: "Sign up at supabase.com and create a free project.",
  },
  {
    icon: KeyRound,
    title: "Run the migration",
    body: "Open the SQL editor, paste supabase/migrations/20260802000001_init.sql, and run it — this creates every table, RLS policy, and trigger.",
  },
  {
    icon: ExternalLink,
    title: "Set the env vars",
    body: "Copy the project URL + anon key from Project Settings → API into .env.local as NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart the dev server.",
  },
];

export function SetupNotice({
  title = "Supabase isn't configured yet",
  description = "EngineerOS stores everything in your own Supabase project. Wire it up to unlock notes, tasks, projects, and daily notes.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-base px-8 py-16 text-foreground">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 inline-flex rounded-md bg-accent-muted p-3">
            <Database className="size-6 text-accent" strokeWidth={1.75} />
          </div>
          <h1 className="mb-2 text-lg font-semibold">{title}</h1>
          <p className="text-sm text-secondary">{description}</p>
        </div>

        <ol className="space-y-3">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <li
                key={step.title}
                className="flex items-start gap-3 rounded-lg border border-default bg-surface p-4"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-muted text-xs font-semibold text-accent">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Icon className="size-4 text-secondary" strokeWidth={1.75} />
                    {step.title}
                  </p>
                  <p className="mt-1 text-sm text-secondary">{step.body}</p>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-6 flex items-center justify-center gap-4 text-sm">
          <Link
            href="https://supabase.com"
            className="inline-flex items-center gap-1.5 font-medium text-accent transition-colors hover:text-accent-hover"
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="size-4" strokeWidth={1.75} />
            Create a project
          </Link>
          <span className="text-faint">·</span>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-medium text-accent transition-colors hover:text-accent-hover"
          >
            Back to landing
          </Link>
        </div>
      </div>
    </div>
  );
}
