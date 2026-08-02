"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDays, format, isToday, subDays } from "date-fns";
import { ArrowLeft, ArrowRight, CalendarDays, CheckSquare, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { PageLoader } from "@/components/shell/PageLoader";
import { DAILY_SECTIONS, useDailyNote, useUpdateDailyNote } from "@/hooks/useDailyNotes";
import { useTasks, useUpdateTask } from "@/hooks/useTasks";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";
import { useSyncedState } from "@/lib/use-synced-state";
import { cn } from "@/lib/utils";
import type { DailySectionKey } from "@/hooks/useDailyNotes";

export function DailyNotePage({ date }: { date: string }) {
  const router = useRouter();
  const { data: workspace } = useWorkspace();
  const workspaceId = workspace?.id ?? null;

  const { data: dailyNote, isLoading } = useDailyNote(workspaceId, date);
  const updateDailyNote = useUpdateDailyNote(workspaceId, date);
  const { data: todaysTasks } = useTasks(workspaceId, { dueDate: date });
  const updateTask = useUpdateTask(workspaceId);

  const parsed = new Date(`${date}T00:00:00`);

  const goTo = (d: Date) => router.push(`/daily/${format(d, "yyyy-MM-dd")}`);

  const todayTasks = (todaysTasks ?? []).filter((t) => t.status !== "done");
  const doneTasks = (todaysTasks ?? []).filter((t) => t.status === "done");

  if (isLoading || !workspace) return <PageLoader label="Opening today's note…" />;

  if (!dailyNote) {
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-64" />
        <div className="mt-6 space-y-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  const toggleTask = (id: string, currentlyDone: boolean) => {
    updateTask.mutate(
      { id, patch: { status: currentlyDone ? "todo" : "done" } },
      { onError: () => toast.error("Failed to update task") }
    );
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-5 text-accent" strokeWidth={1.75} />
          <div>
            <h1 className="text-lg font-semibold">
              {format(parsed, "EEEE, MMMM d")}
              {isToday(parsed) ? (
                <span className="ml-2 rounded bg-accent-muted px-1.5 py-0.5 text-[11px] font-medium text-accent">
                  Today
                </span>
              ) : null}
            </h1>
            <p className="text-sm text-secondary">{format(parsed, "yyyy")}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => goTo(subDays(parsed, 1))}
            aria-label="Previous day"
          >
            <ChevronLeft className="size-4" strokeWidth={1.75} />
          </Button>
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && goTo(new Date(`${e.target.value}T00:00:00`))}
            aria-label="Jump to date"
            className="rounded-md border border-default bg-surface px-2.5 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => goTo(addDays(parsed, 1))}
            aria-label="Next day"
          >
            <ChevronRight className="size-4" strokeWidth={1.75} />
          </Button>
          {!isToday(parsed) ? (
            <Button variant="outline" size="sm" onClick={() => goTo(new Date())}>
              Today
            </Button>
          ) : null}
        </div>
      </div>

      <div className="space-y-4">
        {DAILY_SECTIONS.map((section) => {
          if (section.computed) {
            return (
              <section
                key={section.key}
                className="rounded-lg border border-default bg-surface p-4"
                aria-label={section.label}
              >
                <div className="mb-3 flex items-center gap-2">
                  <CheckSquare className="size-4 text-accent" strokeWidth={1.75} />
                  <h2 className="text-sm font-semibold">{section.label}</h2>
                  <span className="text-xs text-faint">{section.hint}</span>
                </div>

                {todaysTasks?.length === 0 ? (
                  <p className="text-sm text-faint">
                    No tasks due {isToday(parsed) ? "today" : format(parsed, "MMM d")}. Add a due
                    date on the task board to see it here.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {todayTasks.map((task) => (
                      <label
                        key={task.id}
                        className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors duration-150 hover:bg-surface-hover"
                      >
                        <Checkbox
                          checked={false}
                          onCheckedChange={() => toggleTask(task.id, false)}
                        />
                        <span className="flex-1 truncate">{task.title}</span>
                      </label>
                    ))}
                    {doneTasks.map((task) => (
                      <label
                        key={task.id}
                        className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm text-faint line-through transition-colors duration-150 hover:bg-surface-hover"
                      >
                        <Checkbox
                          checked
                          onCheckedChange={() => toggleTask(task.id, true)}
                        />
                        <span className="flex-1 truncate">{task.title}</span>
                      </label>
                    ))}
                  </div>
                )}
              </section>
            );
          }

          return (
            <SectionEditor
              key={section.key}
              label={section.label}
              hint={section.hint}
              value={dailyNote[section.key as DailySectionKey] ?? ""}
              onSave={(value) =>
                updateDailyNote.mutate(
                  { [section.key]: value || null } as never,
                  { onError: () => toast.error("Failed to save section") }
                )
              }
            />
          );
        })}
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-border-subtle pt-4 text-sm text-secondary">
        <Link
          href={`/daily/${format(subDays(parsed, 1), "yyyy-MM-dd")}`}
          className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" strokeWidth={1.75} />
          Yesterday
        </Link>
        <Link
          href={`/daily/${format(addDays(parsed, 1), "yyyy-MM-dd")}`}
          className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
        >
          Tomorrow
          <ArrowRight className="size-4" strokeWidth={1.75} />
        </Link>
      </div>
    </div>
  );
}

function SectionEditor({
  label,
  hint,
  value,
  onSave,
}: {
  label: string;
  hint: string;
  value: string;
  onSave: (value: string) => void;
}) {
  const [local, setLocal] = useSyncedState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (saving) {
      const t = setTimeout(() => setSaving(false), 1200);
      return () => clearTimeout(t);
    }
  }, [saving]);

  const save = useDebouncedCallback((v: string) => {
    onSave(v);
    setSaving(true);
  }, 700);

  const empty = !local.trim();

  return (
    <section className="rounded-lg border border-default bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{label}</h2>
        <span className={cn("text-xs", saving ? "text-secondary" : "text-transparent")}>
          {saving ? "Saving…" : "·"}
        </span>
      </div>
      <textarea
        value={local}
        onChange={(e) => {
          setLocal(e.target.value);
          save(e.target.value);
        }}
        onBlur={() => {
          // Flush any pending debounced save when leaving the field.
          onSave(local);
          setSaving(true);
        }}
        placeholder={empty ? hint : ""}
        rows={empty ? 2 : undefined}
        aria-label={label}
        className="field-sizing-content min-h-16 w-full resize-y rounded-md border border-border-subtle bg-base px-3 py-2 text-sm leading-relaxed text-foreground outline-none transition-colors duration-150 placeholder:text-faint focus:border-default focus:ring-2 focus:ring-ring/30"
      />
    </section>
  );
}
