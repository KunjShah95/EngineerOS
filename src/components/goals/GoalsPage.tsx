"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Target, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shell/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateGoal, useDeleteGoal, useGoals, useUpdateGoal } from "@/hooks/useGoals";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";
import type { Goal, GoalStatus } from "@/types/database";

const STATUS_COLORS: Record<GoalStatus, string> = {
  active: "text-accent",
  achieved: "text-success",
  abandoned: "text-faint",
};

export function GoalsPage() {
  const { data: workspace } = useWorkspace();
  const workspaceId = workspace?.id ?? null;
  const { data: goals, isLoading } = useGoals(workspaceId);
  const createGoal = useCreateGoal(workspaceId);
  const updateGoal = useUpdateGoal(workspaceId);
  const deleteGoal = useDeleteGoal(workspaceId);

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", target_value: "", unit: "", due_date: "" });

  const handleAdd = async () => {
    if (!form.title.trim()) return;
    await createGoal.mutateAsync({
      title: form.title.trim(),
      target_value: form.target_value ? Number(form.target_value) : null,
      unit: form.unit || null,
      due_date: form.due_date || null,
    });
    toast.success("Goal created");
    setForm({ title: "", target_value: "", unit: "", due_date: "" });
    setAdding(false);
  };

  const active = (goals ?? []).filter((g) => g.status === "active");
  const done = (goals ?? []).filter((g) => g.status !== "active");

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-6">
      <PageHeader
        icon={Target}
        title="Goals"
        description="Set targets and track progress toward your objectives."
        className="mb-6"
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" strokeWidth={1.75} /> New Goal
          </Button>
        }
      />

      {adding && (
        <div className="mb-6 space-y-3 rounded-xl border border-default bg-surface p-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input autoFocus placeholder="What do you want to achieve?" value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") void handleAdd(); if (e.key === "Escape") setAdding(false); }} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label>Target</Label>
              <Input type="number" placeholder="100" value={form.target_value}
                onChange={(e) => setForm((f) => ({ ...f, target_value: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Input placeholder="tasks, km, hrs…" value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Due date</Label>
              <Input type="date" value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
            <Button size="sm" onClick={() => void handleAdd()} disabled={!form.title.trim() || createGoal.isPending}>Create</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : (goals ?? []).length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-subtle py-12 text-center text-sm text-faint">
          No goals yet. Create one to get started.
        </div>
      ) : (
        <div className="space-y-4">
          {active.length > 0 && <GoalGroup label="Active" goals={active} updateGoal={updateGoal} deleteGoal={deleteGoal} />}
          {done.length > 0 && <GoalGroup label="Completed / Abandoned" goals={done} updateGoal={updateGoal} deleteGoal={deleteGoal} />}
        </div>
      )}
    </div>
  );
}

function GoalGroup({ label, goals, updateGoal, deleteGoal }: {
  label: string;
  goals: Goal[];
  updateGoal: ReturnType<typeof useUpdateGoal>;
  deleteGoal: ReturnType<typeof useDeleteGoal>;
}) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-secondary">{label}</h2>
      <div className="space-y-2">
        {goals.map((goal) => <GoalCard key={goal.id} goal={goal} updateGoal={updateGoal} deleteGoal={deleteGoal} />)}
      </div>
    </section>
  );
}

function GoalCard({ goal, updateGoal, deleteGoal }: {
  goal: Goal;
  updateGoal: ReturnType<typeof useUpdateGoal>;
  deleteGoal: ReturnType<typeof useDeleteGoal>;
}) {
  const pct = goal.target_value && goal.target_value > 0
    ? Math.min(100, Math.round((goal.current_value / goal.target_value) * 100))
    : null;

  return (
    <div className={cn("rounded-xl border border-default bg-surface p-4", goal.status !== "active" && "opacity-60")}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={cn("font-medium", STATUS_COLORS[goal.status])}>{goal.title}</p>
          {goal.due_date && <p className="text-xs text-faint">Due {goal.due_date}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {goal.status === "active" && (
            <Button size="sm" variant="ghost" className="h-7 text-xs text-success"
              onClick={() => updateGoal.mutate({ id: goal.id, patch: { status: "achieved" } }, { onSuccess: () => toast.success("Goal achieved!") })}>
              Achieved
            </Button>
          )}
          <button type="button" onClick={async () => { await deleteGoal.mutateAsync(goal.id); toast.success("Goal removed"); }}
            className="rounded p-1 text-faint hover:text-danger" aria-label="Delete">
            <Trash2 className="size-3.5" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {pct !== null && (
        <div className="mb-1">
          <div className="mb-1 flex justify-between text-xs text-faint">
            <span>{goal.current_value}{goal.unit ? ` ${goal.unit}` : ""}</span>
            <span>{goal.target_value}{goal.unit ? ` ${goal.unit}` : ""} · {pct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
          </div>
          {goal.status === "active" && (
            <div className="mt-2 flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={goal.target_value ?? undefined}
                value={goal.current_value}
                onChange={(e) => updateGoal.mutate({ id: goal.id, patch: { current_value: Number(e.target.value) } })}
                className="h-7 w-24 text-xs"
              />
              <span className="text-xs text-faint">current {goal.unit ?? "value"}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
