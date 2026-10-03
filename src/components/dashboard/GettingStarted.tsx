"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Check, Sparkles, X } from "lucide-react";

import { useNotes } from "@/hooks/useNotes";
import { useTasks } from "@/hooks/useTasks";
import { useDismissOnboarding, useWorkspace } from "@/hooks/useWorkspace";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useModCombo } from "@/hooks/usePlatformShortcut";
import {
  useClearSampleData,
  useHasSampleData,
  useSeedSampleData,
} from "@/hooks/useSampleWorkspace";
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

const SEARCH_SESSION_KEY = "engineeros:tried-search";

/**
 * sessionStorage-backed "tried the search palette" flag, exposed through
 * useSyncExternalStore (the sanctioned external-store pattern — no
 * setState-in-effect). Server snapshot is always false.
 */
const searchTriedListeners = new Set<() => void>();

function subscribeSearchTried(onChange: () => void): () => void {
  searchTriedListeners.add(onChange);
  return () => searchTriedListeners.delete(onChange);
}

function readSearchTried(): boolean {
  try {
    return sessionStorage.getItem(SEARCH_SESSION_KEY) === "1";
  } catch {
    // sessionStorage may be unavailable (private mode).
    return false;
  }
}

function persistSearchTried(): void {
  try {
    sessionStorage.setItem(SEARCH_SESSION_KEY, "1");
  } catch {
    // ignore — the in-memory notification below still marks this session.
  }
  for (const notify of searchTriedListeners) notify();
}

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
  const reducedMotion = usePrefersReducedMotion();
  const modLabel = useModCombo("K");
  const workspaceId = workspace?.id ?? null;
  const { data: hasSample } = useHasSampleData(workspaceId);
  const seedSample = useSeedSampleData(workspaceId);
  const clearSample = useClearSampleData(workspaceId);

  const [hidden, setHidden] = useState(false);
  const triedSearch = useSyncExternalStore(subscribeSearchTried, readSearchTried, () => false);
  const dismissedOnce = useRef(false);

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
      action: { href: "/tasks?new=1", label: "Add a task" },
    },
    {
      id: "search",
      label: "Search everything at once",
      hint: `${modLabel} finds notes, tasks and saved links — by meaning, not just words.`,
      done: triedSearch,
      action: { open: "palette", label: `Try ${modLabel}` },
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  const allDone = completed === steps.length;

  // Auto-dismiss once every step is complete — the checklist has done its job.
  // setState only happens in the promise callback (never synchronously in the
  // effect body), so a failed write on an old schema still hides the list.
  useEffect(() => {
    if (!workspace || workspace.onboarded_at || hidden || !allDone) return;
    if (dismissedOnce.current) return;
    dismissedOnce.current = true;
    void dismiss().then(() => setHidden(true));
  }, [allDone, dismiss, hidden, workspace]);

  // Already toured, or deliberately dismissed for this session.
  if (!workspace || hidden || workspace.onboarded_at) return null;

  const markSearchTried = () => persistSearchTried();

  const runAction = (action: Step["action"]) => {
    if ("href" in action) return;
    if (action.open === "capture") {
      setQuickCaptureOpen(true);
    } else {
      setCommandPaletteOpen(true);
      markSearchTried();
    }
  };

  const close = () => {
    setHidden(true);
    void dismiss();
  };

  return (
    <motion.section
      aria-label="Get started"
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
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

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-faint">
          <span className="figure-mono text-[11px] text-faint">
        {completed}/{steps.length} done
      </span>
        </p>
        <button
          type="button"
          onClick={close}
          className="text-xs font-medium text-secondary transition-colors hover:text-foreground"
        >
          I&apos;ll figure it out myself
        </button>
      </div>

      {/* One click of real data instead of twenty minutes of typing. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border-subtle pt-3">
        {hasSample ? (
          <button
            type="button"
            onClick={() => clearSample.mutate()}
            disabled={clearSample.isPending}
            className="label-mono transition-colors hover:text-secondary disabled:opacity-50"
          >
            clear sample data
          </button>
        ) : (
          <button
            type="button"
            onClick={() => seedSample.mutate()}
            disabled={seedSample.isPending}
            className="label-mono inline-flex items-center gap-1.5 text-accent transition-colors hover:text-accent-hover disabled:opacity-50"
          >
            <Sparkles className="size-3" strokeWidth={1.75} />
            {seedSample.isPending ? "loading sample data…" : "explore with sample data"}
          </button>
        )}
        <span className="text-[11px] text-faint">
          {hasSample
            ? "The demo project and its notes, tasks and event."
            : "One project, notes, tasks and a calendar event — see everything working."}
        </span>
      </div>
    </motion.section>
  );
}
