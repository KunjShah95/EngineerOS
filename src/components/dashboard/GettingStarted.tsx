"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Check, Sparkles, X } from "lucide-react";

import { useNotes } from "@/hooks/useNotes";
import { useTasks } from "@/hooks/useTasks";
import { useDismissOnboarding, useWorkspace } from "@/hooks/useWorkspace";
import { useUiStore } from "@/lib/store/ui";
import { cn } from "@/lib/utils";

/**
 * First-run checklist.
 *
 * The dashboard a new account lands on is a wall of zeroes — "Done today 0/0",
 * "Streak —" — which is accurate and completely unhelpful. This replaces that
 * first impression with three actions that produce the data the dashboard is
 * built to show, in the order where each one pays off immediately.
 *
 * It dismisses on completion or on request, and never comes back: `onboarded_at`
 * is written to the workspace, so a returning user isn't re-toured. Dismissal
 * swallows write errors on purpose (see useDismissOnboarding) — someone on an
 * un-migrated self-host should be able to close their own checklist.
 */

type Step = {
  id: string;
  label: string;
  hint: string;
  done: boolean;
  action: { href: string; label: string } | { open: "capture" | "palette"; label: string };
};

export function GettingStarted() {
  const { data: workspace } = useWorkspace();
  const { data: notes } = useNotes(workspace?.id ?? null);
  const { data: tasks } = useTasks(workspace?.id ?? null);
  const setQuickCaptureOpen = useUiStore((s) => s.setQuickCaptureOpen);
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const dismiss = useDismissOnboarding();

  const [hidden, setHidden] = useState(false);
  // The search step can't be inferred from stored data — there's no record of
  // having opened the palette — so it's tracked in session state. Persisting it
  // would mean a new table for a one-time nudge.
  const [triedSearch, setTriedSearch] = useState(false);

  // Already toured, or deliberately dismissed for this session.
  if (!workspace || hidden || workspace.onboarded_at) return null;

  const noteCount = notes?.length ?? 0;
  const taskCount = tasks?.length ?? 0;
  const hasDatedTask = (tasks ?? []).some((t) => Boolean(t.due_date));

  const steps: Step[] = [
    {
      id: "capture",
      label: "Get something out of your head",
      hint: "One box, no filing decisions. It lands in your inbox to sort later.",
      done: noteCount > 0 || taskCount > 0,
      action: { open: "capture", label: "Quick capture" },
    },
    {
      id: "task",
      label: "Give one thing a due date",
      hint: "Dated tasks drive Home, the calendar and the daily rollover.",
      done: hasDatedTask,
      action: { href: "/tasks", label: "Add a task" },
    },
    {
      id: "search",
      label: "Search everything at once",
      hint: "⌘K finds notes, tasks and saved links — by meaning, not just words.",
      done: triedSearch,
      action: { open: "palette", label: "Try ⌘K" },
    },
  ];

  const completed = steps.filter((s) => s.done).length;

  /**
   * Dispatch an inline step action.
   *
   * Lives as a function rather than inline in the onClick because the
   * `href`-vs-`open` union doesn't narrow inside a JSX callback — TypeScript can
   * only guarantee the discrimination at the point of the check, and a closure
   * may run after `step` has moved on.
   */
  const runAction = (action: Step["action"]) => {
    if ("href" in action) return;
    if (action.open === "capture") {
      setQuickCaptureOpen(true);
    } else {
      setCommandPaletteOpen(true);
      setTriedSearch(true);
    }
  };

  const close = () => {
    setHidden(true);
    void dismiss();
  };

  return (
    <motion.section
      aria-label="Get started"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-default bg-surface p-5"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Sparkles className="size-4 shrink-0 text-accent" strokeWidth={1.75} />
            Let&apos;s set up your workspace
          </p>
          <p className="mt-1 text-sm text-secondary">
            Three things, about a minute. Skip any of it — nothing here is required.
          </p>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Dismiss the getting-started list"
          className="shrink-0 rounded-md p-1.5 text-faint transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          <X className="size-4" strokeWidth={1.75} />
        </button>
      </div>

      <ol className="space-y-1.5">
        {steps.map((step) => (
          <li
            key={step.id}
            className={cn(
              "flex flex-wrap items-center gap-3 rounded-lg border border-border-subtle px-3 py-2.5 transition-colors duration-150",
              step.done && "opacity-70"
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                step.done
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border-subtle text-faint"
              )}
            >
              {step.done ? <Check className="size-3" strokeWidth={2.5} /> : ""}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-foreground">{step.label}</span>
              <span className="block text-xs text-faint">{step.hint}</span>
            </span>
            {"href" in step.action ? (
              <Link
                href={step.action.href}
                onClick={close}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border-subtle px-2.5 py-1.5 text-xs font-medium text-secondary transition-colors hover:border-accent/30 hover:text-foreground"
              >
                {step.action.label}
                <ArrowRight className="size-3" strokeWidth={2} />
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => runAction(step.action)}
                className="shrink-0 rounded-md border border-border-subtle px-2.5 py-1.5 text-xs font-medium text-secondary transition-colors hover:border-accent/30 hover:text-foreground"
              >
                {step.action.label}
              </button>
            )}
          </li>
        ))}
      </ol>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-faint">
          {completed} of {steps.length} done
        </p>
        <button
          type="button"
          onClick={close}
          className="text-xs font-medium text-secondary transition-colors hover:text-foreground"
        >
          I&apos;ll figure it out myself
        </button>
      </div>
    </motion.section>
  );
}
