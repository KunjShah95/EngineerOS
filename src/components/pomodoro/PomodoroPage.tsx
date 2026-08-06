"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { Coffee, Pause, Play, RotateCcw, Settings, Timer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shell/PageHeader";
import { cn } from "@/lib/utils";

type Phase = "work" | "short_break" | "long_break";

const DEFAULTS: Record<Phase, number> = {
  work: 25 * 60,
  short_break: 5 * 60,
  long_break: 15 * 60,
};

const PHASE_LABELS: Record<Phase, string> = {
  work: "Focus",
  short_break: "Short break",
  long_break: "Long break",
};

const PHASE_COLORS: Record<Phase, string> = {
  work: "text-accent",
  short_break: "text-success",
  long_break: "text-info",
};

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function PomodoroPage() {
  const [phase, setPhase] = useState<Phase>("work");
  const [timeLeft, setTimeLeft] = useState(DEFAULTS.work);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [durations, setDurations] = useState(DEFAULTS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const total = durations[phase];
  const pct = ((total - timeLeft) / total) * 100;
  const circumference = 2 * Math.PI * 88; // radius 88

  const switchPhase = useCallback(
    (next: Phase) => {
      setPhase(next);
      setTimeLeft(durations[next]);
      setRunning(false);
    },
    [durations]
  );

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(intervalRef.current!);
          setRunning(false);
          if (phase === "work") {
            const next = sessions + 1;
            setSessions(next);
            toast.success(`Session ${next} complete! Take a break.`);
            switchPhase(next % 4 === 0 ? "long_break" : "short_break");
          } else {
            toast.success("Break over! Time to focus.");
            switchPhase("work");
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current!);
  }, [running, phase, sessions, switchPhase]);

  // Update document title
  useEffect(() => {
    document.title = running ? `${fmt(timeLeft)} · ${PHASE_LABELS[phase]}` : "Pomodoro · EngineerOS";
    return () => { document.title = "EngineerOS"; };
  }, [running, timeLeft, phase]);

  const reset = () => {
    setRunning(false);
    setTimeLeft(durations[phase]);
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-6">
      <PageHeader
        icon={Timer}
        title="Pomodoro"
        description={`${sessions} session${sessions !== 1 ? "s" : ""} completed today`}
        className="mb-8"
        actions={
          <Button variant="ghost" size="icon" onClick={() => setShowSettings(!showSettings)}>
            <Settings className="size-4" strokeWidth={1.75} />
          </Button>
        }
      />

      {/* Phase selector */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {(["work", "short_break", "long_break"] as Phase[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => switchPhase(p)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              phase === p
                ? "bg-accent-muted text-accent"
                : "text-secondary hover:bg-surface-hover hover:text-foreground"
            )}
          >
            {PHASE_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Timer ring */}
      <div className="relative mx-auto mb-8 flex size-52 items-center justify-center">
        <svg className="absolute inset-0 -rotate-90" width="208" height="208" viewBox="0 0 208 208">
          <circle cx="104" cy="104" r="88" fill="none" stroke="var(--border-default)" strokeWidth="8" />
          <circle
            cx="104"
            cy="104"
            r="88"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - (circumference * pct) / 100}
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        <div className="flex flex-col items-center">
          <span className={cn("text-5xl font-mono font-bold tabular-nums", PHASE_COLORS[phase])}>
            {fmt(timeLeft)}
          </span>
          <span className="mt-1 text-sm text-secondary">{PHASE_LABELS[phase]}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        <Button variant="ghost" size="icon" onClick={reset} aria-label="Reset">
          <RotateCcw className="size-4" strokeWidth={1.75} />
        </Button>
        <Button
          size="lg"
          onClick={() => setRunning(!running)}
          className="w-32"
          aria-label={running ? "Pause" : "Start"}
        >
          {running ? (
            <><Pause className="size-5" strokeWidth={1.75} /> Pause</>
          ) : (
            <><Play className="size-5" strokeWidth={1.75} /> Start</>
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => switchPhase(phase === "work" ? "short_break" : "work")}
          aria-label="Skip to next phase"
          title="Skip"
        >
          <Coffee className="size-4" strokeWidth={1.75} />
        </Button>
      </div>

      {/* Session dots */}
      <div className="mt-8 flex items-center justify-center gap-2">
        {Array.from({ length: Math.max(sessions, 4) }, (_, i) => (
          <span
            key={i}
            className={cn(
              "size-2.5 rounded-full transition-colors",
              i < sessions ? "bg-accent" : "bg-border-subtle"
            )}
          />
        ))}
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="mt-8 rounded-xl border border-default bg-surface p-5 space-y-4">
          <h3 className="text-sm font-semibold">Timer settings (minutes)</h3>
          {(["work", "short_break", "long_break"] as Phase[]).map((p) => (
            <div key={p} className="flex items-center justify-between">
              <label className="text-sm text-secondary">{PHASE_LABELS[p]}</label>
              <input
                type="number"
                min={1}
                max={90}
                value={Math.round(durations[p] / 60)}
                onChange={(e) => {
                  const mins = Math.max(1, Number(e.target.value));
                  setDurations((d) => ({ ...d, [p]: mins * 60 }));
                  if (phase === p) setTimeLeft(mins * 60);
                }}
                className="w-16 rounded-md border border-default bg-base px-2 py-1 text-right text-sm"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
