"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckSquare2, Plus, Trash2, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shell/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateHabit, useDeleteHabit, useHabitEntries, useHabits, useToggleHabitEntry } from "@/hooks/useHabits";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";
import { toISODate, addDays } from "@/lib/calendar";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316"];

function buildLast7(): string[] {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => toISODate(addDays(today, i - 6)));
}

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en", { weekday: "short" }).slice(0, 2);
}

export function HabitsPage() {
  const { data: workspace } = useWorkspace();
  const workspaceId = workspace?.id ?? null;
  const days = buildLast7();
  const from = days[0];
  const to = days[6];

  const { data: habits, isLoading } = useHabits(workspaceId);
  const { data: entries } = useHabitEntries(workspaceId, from, to);
  const createHabit = useCreateHabit(workspaceId);
  const deleteHabit = useDeleteHabit(workspaceId);
  const toggleEntry = useToggleHabitEntry(workspaceId, from, to);

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(COLORS[0]);
  const [adding, setAdding] = useState(false);

  const doneSet = new Set((entries ?? []).filter((e) => e.completed).map((e) => `${e.habit_id}:${e.date}`));

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await createHabit.mutateAsync({ name: newName.trim(), color: newColor });
    toast.success("Habit created");
    setNewName("");
    setAdding(false);
  };

  const handleToggle = (habitId: string, date: string) => {
    const key = `${habitId}:${date}`;
    const next = !doneSet.has(key);
    toggleEntry.mutate({ habitId, date, completed: next });
  };

  const streak = (habitId: string) => {
    let s = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (doneSet.has(`${habitId}:${days[i]}`)) s++;
      else break;
    }
    return s;
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-6">
      <PageHeader
        icon={TrendingUp}
        title="Habits"
        description="Track your daily habits and build streaks."
        className="mb-6"
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" strokeWidth={1.75} /> New Habit
          </Button>
        }
      />

      {adding && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-default bg-surface p-3">
          <Input
            placeholder="Habit name…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleAdd(); if (e.key === "Escape") setAdding(false); }}
            autoFocus
            className="flex-1"
          />
          <div className="flex gap-1">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setNewColor(c)}
                className={cn("size-5 rounded-full transition-transform", newColor === c && "scale-125 ring-2 ring-offset-1 ring-offset-surface")}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <Button size="sm" onClick={() => void handleAdd()} disabled={!newName.trim() || createHabit.isPending}>Add</Button>
          <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
        </div>
      )}

      {/* Header row */}
      <div className="mb-2 grid grid-cols-[1fr_repeat(7,2rem)_4rem_2rem] items-center gap-1 px-3 text-xs text-faint">
        <span>Habit</span>
        {days.map((d) => (
          <span key={d} className="text-center">{dayLabel(d)}</span>
        ))}
        <span className="text-center">Streak</span>
        <span />
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
      ) : (habits ?? []).length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-subtle py-12 text-center text-sm text-faint">
          No habits yet. Add one above.
        </div>
      ) : (
        <div className="space-y-1">
          {(habits ?? []).map((habit) => {
            const s = streak(habit.id);
            return (
              <div
                key={habit.id}
                className="grid grid-cols-[1fr_repeat(7,2rem)_4rem_2rem] items-center gap-1 rounded-xl border border-default bg-surface px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: habit.color ?? "#6366f1" }} />
                  <span className="truncate text-sm font-medium">{habit.name}</span>
                </div>
                {days.map((d) => {
                  const done = doneSet.has(`${habit.id}:${d}`);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => handleToggle(habit.id, d)}
                      aria-label={done ? "Mark incomplete" : "Mark complete"}
                      className={cn(
                        "mx-auto flex size-6 items-center justify-center rounded-full border transition-all",
                        done
                          ? "border-transparent text-white"
                          : "border-border-subtle bg-transparent hover:border-accent/50"
                      )}
                      style={done ? { backgroundColor: habit.color ?? "#6366f1" } : undefined}
                    >
                      {done && <CheckSquare2 className="size-3.5" strokeWidth={2} />}
                    </button>
                  );
                })}
                <span className="text-center text-sm font-semibold" style={{ color: s > 0 ? (habit.color ?? "#6366f1") : "var(--text-tertiary)" }}>
                  {s > 0 ? `${s}🔥` : "—"}
                </span>
                <button
                  type="button"
                  onClick={async () => { await deleteHabit.mutateAsync(habit.id); toast.success("Habit removed"); }}
                  className="rounded p-1 text-faint hover:text-danger"
                  aria-label="Delete habit"
                >
                  <Trash2 className="size-3.5" strokeWidth={1.75} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
