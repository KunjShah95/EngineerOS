"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, Pause, Play, Plus, RotateCcw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * A no-account walkthrough of the daily loop: plan the day, focus on one task,
 * roll unfinished work forward, and write the daily note.
 *
 * Everything here runs in the browser. State is kept in localStorage purely so a
 * visitor's tour survives a reload; nothing is sent to a server. Every storage
 * access is wrapped because private windows and blocked storage throw.
 */

const STORAGE_KEY = "engineeros:tour:v1";
const FOCUS_SECONDS = 25 * 60;

type Priority = "high" | "normal" | "low";
type Task = { id: string; title: string; done: boolean; priority: Priority; day: "today" | "tomorrow"; project: string };
type Note = { goals: string; wins: string; problems: string };
type TourState = { tasks: Task[]; note: Note; sessions: number };

const SEED: TourState = {
  tasks: [
    { id: "t1", title: "Draft the task API schema", done: true, priority: "high", day: "today", project: "Auth service" },
    { id: "t2", title: "Review PR: retry budget", done: false, priority: "normal", day: "today", project: "Infra" },
    { id: "t3", title: "Write ADR for queue choice", done: false, priority: "high", day: "today", project: "Decisions" },
    { id: "t4", title: "Reply to design feedback", done: false, priority: "low", day: "today", project: "Checkout" },
  ],
  note: { goals: "Finish the schema draft and get the ADR out.", wins: "", problems: "" },
  sessions: 0,
};

const PRIORITY_STYLE: Record<Priority, string> = {
  high: "text-danger",
  normal: "text-secondary",
  low: "text-faint",
};

function loadState(): TourState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED;
    const parsed = JSON.parse(raw) as TourState;
    return parsed && Array.isArray(parsed.tasks) ? parsed : SEED;
  } catch {
    return SEED;
  }
}

function saveState(state: TourState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable: the tour still works for this page view.
  }
}

function formatClock(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function ProductTour() {
  // Start from the seed so server and first client render match; swap in the saved
  // tour after mount.
  const [state, setState] = useState<TourState>(SEED);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<"today" | "tomorrow">("today");
  const [draft, setDraft] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(FOCUS_SECONDS);
  const [running, setRunning] = useState(false);
  const [dateLabel, setDateLabel] = useState("");

  useEffect(() => {
    // Hydrate from localStorage and read the date after mount, so SSR markup stays stable.
    /* eslint-disable react-hooks/set-state-in-effect */
    setState(loadState());
    setDateLabel(new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }));
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (hydrated) saveState(state);
  }, [state, hydrated]);

  // The tick is a timer callback, not an effect body, so it can finish a session
  // directly: a completed session counts once, then the clock resets.
  const remainingRef = useRef(FOCUS_SECONDS);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const next = remainingRef.current - 1;
      remainingRef.current = next > 0 ? next : FOCUS_SECONDS;
      if (next > 0) {
        setRemaining(next);
        return;
      }
      setRunning(false);
      setRemaining(FOCUS_SECONDS);
      setState((s) => ({ ...s, sessions: s.sessions + 1 }));
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const visible = useMemo(() => state.tasks.filter((t) => t.day === view), [state.tasks, view]);
  const todayTasks = state.tasks.filter((t) => t.day === "today");
  const doneToday = todayTasks.filter((t) => t.done).length;
  const unfinished = todayTasks.filter((t) => !t.done).length;
  const focusTask = state.tasks.find((t) => t.id === focusId) ?? null;

  function update(fn: (s: TourState) => TourState) {
    setState((s) => fn(s));
  }

  function addTask() {
    const title = draft.trim();
    if (!title) return;
    update((s) => ({
      ...s,
      tasks: [
        ...s.tasks,
        { id: `t${Date.now()}`, title, done: false, priority: "normal", day: view, project: "Inbox" },
      ],
    }));
    setDraft("");
  }

  function toggle(id: string) {
    update((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) }));
  }

  function cyclePriority(id: string) {
    const order: Priority[] = ["high", "normal", "low"];
    update((s) => ({
      ...s,
      tasks: s.tasks.map((t) =>
        t.id === id ? { ...t, priority: order[(order.indexOf(t.priority) + 1) % order.length] } : t
      ),
    }));
  }

  function remove(id: string) {
    update((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));
    if (focusId === id) setFocusId(null);
  }

  /** Mirrors the daily rollover: unfinished today-tasks move to tomorrow. */
  function rollOver() {
    update((s) => ({
      ...s,
      tasks: s.tasks.map((t) => (t.day === "today" && !t.done ? { ...t, day: "tomorrow" } : t)),
    }));
    setView("tomorrow");
  }

  function reset() {
    setState(SEED);
    setFocusId(null);
    setRunning(false);
    setRemaining(FOCUS_SECONDS);
    remainingRef.current = FOCUS_SECONDS;
    setView("today");
  }

  const progress = todayTasks.length === 0 ? 0 : Math.round((doneToday / todayTasks.length) * 100);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
      <div className="flex flex-col gap-3 border-b border-border-subtle pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="label-mono">Interactive tour · no account</p>
          <h1 className="mt-3 font-serif-display text-[clamp(2.2rem,5vw,3.4rem)] leading-[1.02] tracking-[-0.02em] text-foreground">
            Your day, <em className="font-light text-secondary italic">in one screen.</em>
          </h1>
          <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-secondary">
            Plan today, focus on one task, roll the rest forward, and write the daily note. Try it. Your tour is saved
            in this browser only.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={reset}>
            <RotateCcw className="size-3.5" /> Reset tour
          </Button>
          <Link href="/register">
            <Button size="sm">
              Keep this workspace <ArrowRight className="size-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1.25fr_1fr]">
        {/* Tasks */}
        <section aria-labelledby="tour-tasks" className="rounded-lg border border-border-subtle bg-elevated">
          <header className="flex items-center justify-between gap-4 border-b border-border-subtle px-4 py-3">
            <div>
              <h2 id="tour-tasks" className="text-sm font-semibold">
                {view === "today" ? "Today" : "Tomorrow"}
                <span className="ml-2 font-mono text-[11px] font-normal text-faint">{dateLabel}</span>
              </h2>
              <p className="mt-0.5 font-mono text-[11px] text-faint">
                {doneToday}/{todayTasks.length} done · {progress}%
              </p>
            </div>
            <div role="tablist" aria-label="Day" className="flex rounded-md border border-border-subtle p-0.5">
              {(["today", "tomorrow"] as const).map((v) => (
                <button
                  key={v}
                  role="tab"
                  aria-selected={view === v}
                  onClick={() => setView(v)}
                  className={cn(
                    "rounded px-2.5 py-1 text-xs capitalize transition-colors",
                    view === v ? "bg-muted text-foreground" : "text-secondary hover:text-foreground"
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </header>

          <form
            className="flex gap-2 border-b border-border-subtle p-3"
            onSubmit={(e) => {
              e.preventDefault();
              addTask();
            }}
          >
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Add a task to ${view}…`}
              aria-label="New task"
              maxLength={200}
            />
            <Button type="submit" size="sm" variant="secondary" disabled={!draft.trim()}>
              <Plus className="size-3.5" /> Add
            </Button>
          </form>

          <ul className="divide-y divide-border-subtle">
            {visible.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-faint">Nothing planned. Add one above.</li>
            ) : null}
            {visible.map((task) => (
              <li key={task.id} className={cn("group flex items-center gap-3 px-4 py-3", focusId === task.id && "bg-muted/50")}>
                <button
                  onClick={() => toggle(task.id)}
                  aria-label={task.done ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`}
                  aria-pressed={task.done}
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-[3px] border transition-colors",
                    task.done ? "border-success bg-success/15 text-success" : "border-border-subtle hover:border-foreground"
                  )}
                >
                  {task.done ? <Check className="size-3" strokeWidth={3} /> : null}
                </button>
                <button
                  onClick={() => cyclePriority(task.id)}
                  aria-label={`Priority: ${task.priority}. Click to change`}
                  className={cn("font-mono text-[10px] uppercase tracking-wider", PRIORITY_STYLE[task.priority])}
                >
                  {task.priority}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-[13px]", task.done ? "text-faint line-through" : "text-foreground")}>
                    {task.title}
                  </p>
                  <p className="font-mono text-[10px] text-faint">{task.project}</p>
                </div>
                <button
                  onClick={() => setFocusId(task.id)}
                  className={cn(
                    "rounded px-2 py-1 text-[11px] transition-colors",
                    focusId === task.id
                      ? "text-signal"
                      : "text-secondary hover:text-foreground md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                  )}
                >
                  Focus
                </button>
                <button
                  onClick={() => remove(task.id)}
                  aria-label={`Delete "${task.title}"`}
                  className="rounded p-1 text-faint transition-opacity hover:text-danger md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>

          {view === "today" ? (
            <footer className="flex items-center justify-between gap-3 border-t border-border-subtle px-4 py-3">
              <p className="text-xs text-secondary">
                {unfinished > 0 ? `${unfinished} unfinished. Roll them to tomorrow?` : "All clear for today."}
              </p>
              <Button size="sm" variant="secondary" onClick={rollOver} disabled={unfinished === 0}>
                <ArrowUpRight className="size-3.5" /> Roll over
              </Button>
            </footer>
          ) : null}
        </section>

        <div className="flex flex-col gap-6">
          {/* Focus */}
          <section aria-labelledby="tour-focus" className="rounded-lg border border-border-subtle bg-elevated p-4">
            <div className="flex items-center justify-between">
              <h2 id="tour-focus" className="text-sm font-semibold">
                Focus
              </h2>
              <span className="font-mono text-[11px] text-faint">{state.sessions} sessions today</span>
            </div>
            <p className="mt-3 truncate text-[13px] text-secondary">
              {focusTask ? focusTask.title : "Pick a task and press Focus."}
            </p>
            <div className="mt-3 flex items-center justify-between gap-4">
              <span className="font-mono text-4xl tabular-nums text-signal" aria-live="off">
                {formatClock(remaining)}
              </span>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setRunning((r) => !r)} disabled={!focusTask && !running}>
                  {running ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                  {running ? "Pause" : "Start 25 min"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setRunning(false);
                    setRemaining(FOCUS_SECONDS);
                    remainingRef.current = FOCUS_SECONDS;
                  }}
                >
                  <RotateCcw className="size-3.5" />
                </Button>
              </div>
            </div>
          </section>

          {/* Daily note */}
          <section aria-labelledby="tour-note" className="rounded-lg border border-border-subtle bg-elevated p-4">
            <h2 id="tour-note" className="text-sm font-semibold">
              Daily note
            </h2>
            <div className="mt-3 space-y-3">
              {(
                [
                  ["goals", "Goals for today"],
                  ["wins", "Wins"],
                  ["problems", "Problems"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-faint">{label}</span>
                  <textarea
                    value={state.note[key]}
                    maxLength={500}
                    onChange={(e) =>
                      update((s) => ({ ...s, note: { ...s.note, [key]: e.target.value } }))
                    }
                    rows={2}
                    className="mt-1 w-full resize-none rounded-md border border-border-subtle bg-transparent px-3 py-2 text-[13px] text-foreground placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                    placeholder="Write a line…"
                  />
                </label>
              ))}
            </div>
          </section>

          <div className="rounded-lg border border-dashed border-border-subtle p-4 text-[13px] text-secondary">
            <p className="font-medium text-foreground">What happens next</p>
            <p className="mt-1 leading-relaxed">
              In a real workspace, tasks link to the notes and decisions behind them, unfinished work rolls forward
              every morning, and the assistant can answer “what did I decide about the queue?” with the note it came from.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
