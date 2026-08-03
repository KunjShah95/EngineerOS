"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarClock,
  CheckCircle2,
  Inbox,
  Play,
  Plus,
  RefreshCw,
  Sun,
  Trash2,
  Workflow,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageLoader } from "@/components/shell/PageLoader";
import { PageHeader } from "@/components/shell/PageHeader";
import {
  useAutomationDrain,
  useAutomationRules,
  useCreateAutomationRule,
  useDeleteAutomationRule,
  useUpdateAutomationRule,
} from "@/hooks/useAutomation";
import { useProjects } from "@/hooks/useProjects";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cadenceLabel } from "@/lib/automation";
import type {
  AutoTriageRule,
  AutomationRule,
  RecurringCadence,
  RecurringTaskConfig,
} from "@/types/database";

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function AutomationPage() {
  const { data: workspace, isLoading } = useWorkspace();
  const workspaceId = workspace?.id ?? null;
  const { data: rules, isLoading: rulesLoading } = useAutomationRules(workspaceId);
  const { data: projects } = useProjects(workspaceId);
  const createRule = useCreateAutomationRule(workspaceId);
  const updateRule = useUpdateAutomationRule(workspaceId);
  const deleteRule = useDeleteAutomationRule(workspaceId);
  const drain = useAutomationDrain();

  const recurring = useMemo(() => (rules ?? []).filter((r) => r.kind === "recurring_task"), [rules]);
  const triageRule = useMemo(() => (rules ?? []).find((r) => r.kind === "auto_triage"), [rules]);
  const rolloverRule = useMemo(() => (rules ?? []).find((r) => r.kind === "daily_rollover"), [rules]);

  const runNow = () => {
    toast.promise(drain.mutateAsync(), {
      loading: "Running automation…",
      success: (s) =>
        `Created ${s.recurring_created} task(s) · triaged ${s.triaged} · rollover ${s.rollover_done ? "done" : "n/a"} · ${s.reminders_created} reminder(s) · ${s.digests_sent} digest(s)`,
      error: "Automation run failed",
    });
  };

  if (isLoading) return <PageLoader label="Loading automation…" />;
  if (!workspace) return null;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 p-6">
      <PageHeader
        icon={Workflow}
        title="Automation"
        description="Recurring tasks, quick-capture triage, and daily rollover — evaluated in the background."
        actions={
          <Button onClick={() => void runNow()} disabled={drain.isPending}>
            {drain.isPending ? (
              <RefreshCw className="size-3.5 animate-spin" strokeWidth={1.75} />
            ) : (
              <Play className="size-3.5" strokeWidth={1.75} />
            )}
            Run now
          </Button>
        }
      />

      {rulesLoading ? (
        <PageLoader label="Loading rules…" />
      ) : (
        <>
          <RecurringSection
            rules={recurring}
            projects={projects ?? []}
            onCreate={createRule.mutateAsync}
            onToggle={(id, enabled) => updateRule.mutate({ id, patch: { enabled } })}
            onDelete={(id) => void deleteRule.mutateAsync(id)}
          />

          <TriageSection
            rule={triageRule ?? null}
            projects={projects ?? []}
            onCreate={createRule.mutateAsync}
            onUpdate={(id, patch) => updateRule.mutate({ id, patch: patch as never })}
            onDelete={(id) => void deleteRule.mutateAsync(id)}
          />

          <RolloverSection
            rule={rolloverRule ?? null}
            onCreate={createRule.mutateAsync}
            onToggle={(id, enabled) => updateRule.mutate({ id, patch: { enabled } })}
            onDelete={(id) => void deleteRule.mutateAsync(id)}
          />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recurring tasks
// ---------------------------------------------------------------------------

function RecurringSection({
  rules,
  projects,
  onCreate,
  onToggle,
  onDelete,
}: {
  rules: AutomationRule[];
  projects: { id: string; name: string }[];
  onCreate: (input: { kind: "recurring_task"; name: string; config: unknown }) => Promise<unknown>;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [cadenceType, setCadenceType] = useState<"daily" | "weekly" | "monthly">("daily");
  const [weekday, setWeekday] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [projectId, setProjectId] = useState("none");
  const [dueOffset, setDueOffset] = useState(0);
  const [remindMinutes, setRemindMinutes] = useState(0);

  const submit = async () => {
    if (!title.trim()) {
      toast.error("Give the recurring task a title");
      return;
    }
    const cadence: RecurringCadence =
      cadenceType === "daily"
        ? { type: "daily" }
        : cadenceType === "weekly"
          ? { type: "weekly", weekday }
          : { type: "monthly", day_of_month: dayOfMonth };
    try {
      await onCreate({
        kind: "recurring_task",
        name: title.trim(),
        config: {
          title: title.trim(),
          cadence,
          project_id: projectId === "none" ? null : projectId,
          due_offset_days: dueOffset,
          remind_after_minutes: remindMinutes > 0 ? remindMinutes : undefined,
        } satisfies RecurringTaskConfig,
      });
      setTitle("");
      toast.success("Recurring task added");
    } catch {
      toast.error("Could not add recurring task");
    }
  };

  return (
    <section className="rounded-lg border border-default bg-surface p-5">
      <div className="mb-4 flex items-center gap-2">
        <CalendarClock className="size-4 text-accent" strokeWidth={1.75} />
        <h2 className="text-sm font-semibold">Recurring tasks</h2>
        <span className="text-xs text-faint">auto-created when due</span>
      </div>

      {rules.length > 0 && (
        <ul className="mb-5 divide-y divide-border-subtle">
          {rules.map((rule) => {
            const cfg = rule.config as RecurringTaskConfig;
            return (
              <li key={rule.id} className="flex items-center gap-3 py-2.5">
                <Switch
                  checked={rule.enabled}
                  onCheckedChange={(v) => onToggle(rule.id, v)}
                  aria-label="Enabled"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{cfg.title}</p>
                  <p className="text-xs text-faint">
                    {cadenceLabel(cfg.cadence)}
                    {cfg.due_offset_days ? ` · due +${cfg.due_offset_days}d` : ""}
                    {cfg.remind_after_minutes ? ` · remind +${cfg.remind_after_minutes}m` : ""}
                    {cfg.project_id ? " · in project" : ""}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-faint">
                  {rule.last_run_at ? `last ${new Date(rule.last_run_at).toLocaleDateString()}` : "never"}
                </span>
                <button
                  type="button"
                  aria-label="Delete rule"
                  onClick={() => onDelete(rule.id)}
                  className="shrink-0 rounded p-1.5 text-faint transition-colors hover:bg-surface-hover hover:text-danger"
                >
                  <Trash2 className="size-3.5" strokeWidth={1.75} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="rt-title">Title</Label>
          <Input
            id="rt-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Weekly review"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Cadence</Label>
          <Select value={cadenceType} onValueChange={(v) => setCadenceType(v as typeof cadenceType)}>
            <SelectTrigger aria-label="Cadence">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {cadenceType === "weekly" ? (
          <div className="space-y-1.5">
            <Label>Weekday</Label>
            <Select value={String(weekday)} onValueChange={(v) => setWeekday(Number(v))}>
              <SelectTrigger aria-label="Weekday">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEKDAY_NAMES.map((name, i) => (
                  <SelectItem key={name} value={String(i)}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : cadenceType === "monthly" ? (
          <div className="space-y-1.5">
            <Label>Day of month</Label>
            <Select value={String(dayOfMonth)} onValueChange={(v) => setDayOfMonth(Number(v))}>
              <SelectTrigger aria-label="Day of month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="rt-offset">Due in (days)</Label>
            <Input
              id="rt-offset"
              type="number"
              min={0}
              value={dueOffset}
              onChange={(e) => setDueOffset(Number(e.target.value))}
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Project</Label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger aria-label="Project">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No project</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rt-remind">Remind after (min)</Label>
          <Input
            id="rt-remind"
            type="number"
            min={0}
            value={remindMinutes}
            onChange={(e) => setRemindMinutes(Number(e.target.value))}
            placeholder="0 = none"
          />
        </div>
        <div className="flex items-end sm:col-span-2 lg:col-span-1">
          <Button onClick={() => void submit()} className="w-full">
            <Plus className="size-3.5" strokeWidth={1.75} />
            Add rule
          </Button>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Auto-triage
// ---------------------------------------------------------------------------

function TriageSection({
  rule,
  projects,
  onCreate,
  onUpdate,
  onDelete,
}: {
  rule: AutomationRule | null;
  projects: { id: string; name: string }[];
  onCreate: (input: { kind: "auto_triage"; name: string; config: unknown }) => Promise<unknown>;
  onUpdate: (id: string, patch: { config?: unknown; enabled?: boolean }) => void;
  onDelete: (id: string) => void;
}) {
  const [match, setMatch] = useState("");
  const [action, setAction] = useState<"note" | "task">("task");
  const [projectId, setProjectId] = useState("none");

  const triageRules = (rule?.config as { rules?: AutoTriageRule[] } | undefined)?.rules ?? [];

  const addRule = async () => {
    if (!match.trim()) {
      toast.error("Enter a keyword to match");
      return;
    }
    const next: AutoTriageRule[] = [
      ...triageRules,
      { match: match.trim(), action, project_id: projectId === "none" ? null : projectId },
    ];
    try {
      if (rule) {
        onUpdate(rule.id, { config: { rules: next } });
      } else {
        await onCreate({ kind: "auto_triage", name: "Quick-capture triage", config: { rules: next } });
      }
      setMatch("");
      toast.success("Triage rule added");
    } catch {
      toast.error("Could not save triage rule");
    }
  };

  const removeAt = (index: number) => {
    const next = triageRules.filter((_, i) => i !== index);
    if (rule) {
      if (next.length === 0) {
        onDelete(rule.id);
      } else {
        onUpdate(rule.id, { config: { rules: next } });
      }
    }
  };

  return (
    <section className="rounded-lg border border-default bg-surface p-5">
      <div className="mb-4 flex items-center gap-2">
        <Inbox className="size-4 text-accent" strokeWidth={1.75} />
        <h2 className="text-sm font-semibold">Quick-capture auto-triage</h2>
        <span className="text-xs text-faint">keyword → note or task</span>
        {rule && (
          <Switch
            checked={rule.enabled}
            onCheckedChange={(v) => onUpdate(rule.id, { enabled: v })}
            aria-label="Enabled"
            className="ml-auto"
          />
        )}
      </div>

      <p className="mb-4 text-sm text-secondary">
        When a quick capture matches a keyword below, it&apos;s converted automatically (first match
        wins, case-insensitive). Captures without a match stay in the inbox.
      </p>

      {triageRules.length > 0 && (
        <ul className="mb-4 divide-y divide-border-subtle">
          {triageRules.map((r, i) => (
            <li key={`${r.match}-${i}`} className="flex items-center gap-3 py-2">
              <span className="rounded bg-accent-muted px-1.5 py-0.5 font-mono text-xs text-accent">
                {r.match}
              </span>
              <span className="text-xs text-faint capitalize">→ {r.action}</span>
              {r.project_id ? <span className="text-xs text-faint">· in project</span> : null}
              <button
                type="button"
                aria-label="Remove triage rule"
                onClick={() => removeAt(i)}
                className="ml-auto shrink-0 rounded p-1.5 text-faint transition-colors hover:bg-surface-hover hover:text-danger"
              >
                <Trash2 className="size-3.5" strokeWidth={1.75} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="tg-match">Keyword</Label>
          <Input
            id="tg-match"
            value={match}
            onChange={(e) => setMatch(e.target.value)}
            placeholder="e.g. todo:"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Convert to</Label>
          <Select value={action} onValueChange={(v) => setAction(v as typeof action)}>
            <SelectTrigger aria-label="Convert to">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="task">Task</SelectItem>
              <SelectItem value="note">Note</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Project</Label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger aria-label="Project">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No project</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button onClick={() => void addRule()} className="w-full" variant="outline">
            <Plus className="size-3.5" strokeWidth={1.75} />
            Add keyword
          </Button>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Daily rollover + reminders
// ---------------------------------------------------------------------------

function RolloverSection({
  rule,
  onCreate,
  onToggle,
  onDelete,
}: {
  rule: AutomationRule | null;
  onCreate: (input: { kind: "daily_rollover"; name: string; config: unknown }) => Promise<unknown>;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const create = async () => {
    try {
      await onCreate({ kind: "daily_rollover", name: "Daily rollover", config: {} });
      toast.success("Daily rollover enabled");
    } catch {
      toast.error("Could not enable daily rollover");
    }
  };

  const remove = () => {
    if (rule) onDelete(rule.id);
  };

  return (
    <section className="rounded-lg border border-default bg-surface p-5">
      <div className="mb-3 flex items-center gap-2">
        <Sun className="size-4 text-accent" strokeWidth={1.75} />
        <h2 className="text-sm font-semibold">Daily rollover + reminders</h2>
        {rule && (
          <Switch
            checked={rule.enabled}
            onCheckedChange={(v) => onToggle(rule.id, v)}
            aria-label="Enabled"
            className="ml-auto"
          />
        )}
      </div>
      <p className="text-sm text-secondary">
        Ensures today&apos;s daily note exists and copies yesterday&apos;s &ldquo;Tomorrow&rdquo; into
        today&apos;s &ldquo;Morning Goals&rdquo; when empty. Reminders surface due/overdue tasks on the
        dashboard each run.
      </p>
      {rule ? (
        <div className="mt-3 flex items-center gap-3 text-xs text-faint">
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="size-3" strokeWidth={1.75} />
            {rule.last_run_at ? `Last rollover ${new Date(rule.last_run_at).toLocaleString()}` : "Not run yet"}
          </span>
          <button
            type="button"
            onClick={remove}
            className="ml-auto inline-flex items-center gap-1 text-danger transition-colors hover:opacity-80"
          >
            <Trash2 className="size-3" strokeWidth={1.75} />
            Disable
          </button>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="mt-3" onClick={() => void create()}>
          <Plus className="size-3.5" strokeWidth={1.75} />
          Enable daily rollover
        </Button>
      )}
    </section>
  );
}
