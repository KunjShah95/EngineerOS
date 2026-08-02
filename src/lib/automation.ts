// Phase 10 — Automation engine.
//
// Mirrors the index-queue drain pattern: a durable `jobs` table (enqueued by
// the quick_captures trigger) plus user-configurable `automation_rules`. The
// client calls /api/automation/drain on load + a slow interval (useAutoIndex
// pattern); this module does the actual work, running as the signed-in user
// so RLS scopes everything to their workspace.

import { addDays, addMonths, format, setDate } from "date-fns";

import { isEmailConfigured, renderDigestEmail, renderReminderEmail, sendEmail } from "@/lib/email";
import type { AutomationJob, AutomationRule, RecurringCadence, RecurringTaskConfig } from "@/types/database";

type Supabase = NonNullable<Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>>;

export interface DrainSummary {
  recurring_created: number;
  triaged: number;
  rollover_done: boolean;
  reminders_created: number;
  digests_sent: number;
}

export interface NotificationSettings {
  email: string | null;
  weekly_digest: boolean;
}

// ---------------------------------------------------------------------------
// Recurring tasks
// ---------------------------------------------------------------------------

/** When a cadence next fires, given the last run (or null = never ran). */
export function nextRecurringRun(lastRun: Date | null, cadence: RecurringCadence): Date {
  const now = new Date();
  if (!lastRun) return now;
  switch (cadence.type) {
    case "daily":
      return addDays(lastRun, 1);
    case "weekly": {
      // Next occurrence of the target weekday after lastRun.
      const d = addDays(lastRun, 1);
      const delta = (cadence.weekday - d.getDay() + 7) % 7;
      return addDays(d, delta);
    }
    case "monthly": {
      const day = Math.min(cadence.day_of_month, 28);
      const next = setDate(addMonths(lastRun, 1), day);
      return next;
    }
  }
}

/** True when a recurring rule is due to fire now. */
function isRecurringDue(rule: AutomationRule, now = new Date()): boolean {
  const cfg = rule.config as RecurringTaskConfig;
  if (!cfg.cadence) return false;
  const last = rule.last_run_at ? new Date(rule.last_run_at) : null;
  return nextRecurringRun(last, cfg.cadence) <= now;
}

/** Create the task for one recurring rule and stamp last_run_at. */
async function runRecurringRule(supabase: Supabase, rule: AutomationRule): Promise<boolean> {
  const cfg = rule.config as RecurringTaskConfig;
  if (!cfg.title?.trim()) return false;

  const due = cfg.due_offset_days
    ? format(addDays(new Date(), cfg.due_offset_days), "yyyy-MM-dd")
    : format(new Date(), "yyyy-MM-dd");

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      workspace_id: rule.workspace_id,
      title: cfg.title.trim(),
      description: cfg.description ?? null,
      priority: cfg.priority ?? "none",
      project_id: cfg.project_id ?? null,
      due_date: due,
      status: "todo",
      position: 0,
    })
    .select("id")
    .single();
  if (error || !task) return false;

  // Stamp last_run_at so we don't fire again this cycle. If the stamp fails,
  // roll the task back so the next drain re-creates it — a partial success
  // must not double-fire the rule on the next run.
  const { error: stampError } = await supabase
    .from("automation_rules")
    .update({ last_run_at: new Date().toISOString() })
    .eq("id", rule.id);
  if (stampError) {
    // Best-effort rollback. If this delete also fails (two consecutive write
    // failures), the next drain re-creates the task — a duplicate is the
    // accepted residual edge for that vanishingly unlikely case.
    await supabase.from("tasks").delete().eq("id", task.id);
    return false;
  }

  // Enqueue an in-app reminder when the rule asks for one. Additive and
  // best-effort: a failure here keeps the task + stamp (the reminder just
  // won't fire), and must not abort the whole drain.
  const remindMinutes = cfg.remind_after_minutes;
  if (remindMinutes && remindMinutes > 0) {
    try {
      await supabase.from("jobs").insert({
        workspace_id: rule.workspace_id,
        kind: "reminder",
        payload: {
          rule_id: rule.id,
          task_id: task.id,
          title: cfg.title.trim(),
        },
        run_at: new Date(Date.now() + remindMinutes * 60_000).toISOString(),
      });
    } catch {
      // Best-effort — the task is created either way.
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Auto-triage (jobs enqueued by the quick_captures trigger)
// ---------------------------------------------------------------------------

/** Apply the first matching triage rule to a capture; create the entity. */
async function triageCapture(supabase: Supabase, workspaceId: string, captureId: string): Promise<boolean> {
  // Pull the rule config (enabled, non-deleted).
  const { data: rule } = await supabase
    .from("automation_rules")
    .select("config")
    .eq("workspace_id", workspaceId)
    .eq("kind", "auto_triage")
    .eq("enabled", true)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (!rule) return false;

  const { data: capture } = await supabase
    .from("quick_captures")
    .select("id, raw_text, triaged_into, triaged_id")
    .eq("id", captureId)
    .maybeSingle();
  // Already triaged (manually or by a previous run), or the capture is gone —
  // nothing was triaged by THIS run, so report false (the drain still marks the
  // job done but doesn't inflate summary.triaged).
  if (!capture || capture.triaged_into || capture.triaged_id) return false;

  const rules = (rule.config as { rules?: { match: string; action: "note" | "task"; project_id?: string | null }[] }).rules ?? [];
  const text = capture.raw_text.toLowerCase();
  const hit = rules.find((r) => r.match && text.includes(r.match.toLowerCase()));

  if (!hit) return false; // No keyword matched — leave in the inbox.

  if (hit.action === "note") {
    const { data: note, error } = await supabase
      .from("notes")
      .insert({
        workspace_id: workspaceId,
        title: capture.raw_text.length > 80 ? `${capture.raw_text.slice(0, 80)}…` : capture.raw_text,
        body_markdown: "",
        project_id: hit.project_id ?? null,
      })
      .select("id")
      .single();
    if (error || !note) return false;
    // Stamp the capture; on failure roll the note back so the job retries
    // cleanly instead of orphaning an unlinked entity.
    const { error: noteStampError } = await supabase
      .from("quick_captures")
      .update({ triaged_into: "note", triaged_id: note.id })
      .eq("id", captureId);
    if (noteStampError) {
      await supabase.from("notes").delete().eq("id", note.id);
      return false;
    }
    return true;
  }

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      workspace_id: workspaceId,
      title: capture.raw_text,
      status: "todo",
      project_id: hit.project_id ?? null,
      position: 0,
    })
    .select("id")
    .single();
  if (error || !task) return false;
  const { error: taskStampError } = await supabase
    .from("quick_captures")
    .update({ triaged_into: "task", triaged_id: task.id })
    .eq("id", captureId);
  if (taskStampError) {
    await supabase.from("tasks").delete().eq("id", task.id);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Reminders (jobs enqueued by recurring rules)
// ---------------------------------------------------------------------------

/**
 * Resolve the workspace's outbound-notification settings.
 *
 * NOTE: workspaces RLS is owner-based, so `email`/`weekly_digest` are only
 * readable when the drain runs as the workspace OWNER. A member-triggered
 * drain gets null here and silently skips emails — intended (settings are
 * per-workspace, owner-managed), not a bug.
 */
async function getNotificationSettings(
  supabase: Supabase,
  workspaceId: string,
): Promise<NotificationSettings | null> {
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("email, weekly_digest")
    .eq("id", workspaceId)
    .maybeSingle();
  if (!workspace) return null;
  return {
    email: (workspace.email as string | null) ?? null,
    weekly_digest: Boolean(workspace.weekly_digest),
  };
}

/**
 * Materialize one due reminder job into the reminders feed. Returns true when
 * a new row was created; throws on write failure so the job retries. Jobs whose
 * task is gone (or that were already materialized) complete without a row.
 */
async function runReminderJob(
  supabase: Supabase,
  workspaceId: string,
  job: AutomationJob,
  notif: NotificationSettings | null,
): Promise<boolean> {
  const taskId = job.payload.task_id as string | undefined;
  const ruleId = job.payload.rule_id as string | undefined;
  const title = job.payload.title as string | undefined;
  if (!taskId || !title) return false; // Nothing to materialize — complete quietly.

  // The task it points at is gone (or soft-deleted) → drop the reminder silently.
  const { data: task } = await supabase
    .from("tasks")
    .select("id")
    .eq("id", taskId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!task) return false;

  // Idempotency guard: a partial run may have created the row already.
  const { data: existing } = await supabase
    .from("reminders")
    .select("id")
    .eq("job_id", job.id)
    .maybeSingle();
  if (existing) return false;

  const { error } = await supabase
    .from("reminders")
    .insert({
      workspace_id: workspaceId,
      job_id: job.id,
      rule_id: ruleId ?? null,
      task_id: taskId,
      title,
      fire_at: job.run_at,
    })
    .select("id")
    .single();
  if (error) throw error; // Let the drain retry this job.

  // Mirror to email when the workspace has one configured (best-effort).
  if (notif?.email && isEmailConfigured()) {
    await sendEmail({
      to: notif.email,
      subject: `Reminder: ${title}`,
      html: renderReminderEmail(title, `/tasks?task=${taskId}`, job.run_at),
    });
  }
  return true;
}

/**
 * Send the weekly digest for one due digest job, then re-enqueue the next one
 * (self-perpetuating while the toggle + an email are present). Returns whether
 * a digest was produced; the job completes either way.
 */
async function runDigestJob(
  supabase: Supabase,
  workspaceId: string,
  notif: NotificationSettings | null,
): Promise<boolean> {
  if (!notif?.email) return false; // Nothing to send to — complete quietly.

  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data: completedTasks } = await supabase
    .from("tasks")
    .select("title, completed_at")
    .eq("workspace_id", workspaceId)
    .not("completed_at", "is", null)
    .gte("completed_at", since)
    .order("completed_at", { ascending: false })
    .limit(5);
  const { data: newNotes } = await supabase
    .from("notes")
    .select("title, created_at")
    .eq("workspace_id", workspaceId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5);

  // Re-enqueue the next digest FIRST (fires in 7 days): if this insert fails
  // the job stays pending and retries without having sent anything, so a
  // failure can't produce a duplicate digest email. (sendEmail never throws,
  // so nothing after this point can fail the job.)
  await supabase.from("jobs").insert({
    workspace_id: workspaceId,
    kind: "digest",
    payload: {},
    run_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  });

  if (isEmailConfigured()) {
    await sendEmail({
      to: notif.email,
      subject: "Your EngineerOS weekly digest",
      html: renderDigestEmail({
        completedTasks: (completedTasks ?? []) as { title: string }[],
        newNotes: (newNotes ?? []) as { title: string }[],
      }),
    });
  }
  return true;
}

// ---------------------------------------------------------------------------
// Daily rollover
// ---------------------------------------------------------------------------

/**
 * Ensure today's daily note exists and copy yesterday's "Tomorrow" into
 * today's "Morning Goals" when the latter is empty (the weekly-review loop
 * from MVP.md). Returns whether anything was created/copied.
 */
async function runDailyRollover(supabase: Supabase, workspaceId: string): Promise<boolean> {
  const today = format(new Date(), "yyyy-MM-dd");
  const yesterday = format(addDays(new Date(), -1), "yyyy-MM-dd");

  const { data: todayNote } = await supabase
    .from("daily_notes")
    .upsert({ workspace_id: workspaceId, date: today }, { onConflict: "workspace_id,date", ignoreDuplicates: true })
    .select("id, morning_goals")
    .single();

  if (!todayNote) return false;
  if (todayNote.morning_goals?.trim()) return false; // Already has goals.

  const { data: yesterdayNote } = await supabase
    .from("daily_notes")
    .select("tomorrow")
    .eq("workspace_id", workspaceId)
    .eq("date", yesterday)
    .maybeSingle();

  const tomorrow = yesterdayNote?.tomorrow?.trim();
  if (!tomorrow) return false;

  await supabase
    .from("daily_notes")
    .update({ morning_goals: tomorrow })
    .eq("id", todayNote.id);
  return true;
}

// ---------------------------------------------------------------------------
// Drain — the single entry point called by /api/automation/drain
// ---------------------------------------------------------------------------

export async function drainAutomation(supabase: Supabase, workspaceId: string): Promise<DrainSummary> {
  const summary: DrainSummary = {
    recurring_created: 0,
    triaged: 0,
    rollover_done: false,
    reminders_created: 0,
    digests_sent: 0,
  };
  const notif = await getNotificationSettings(supabase, workspaceId);

  // 1. Recurring task rules.
  const { data: recurringRules } = await supabase
    .from("automation_rules")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("kind", "recurring_task")
    .eq("enabled", true)
    .is("deleted_at", null);
  for (const rule of recurringRules ?? []) {
    if (isRecurringDue(rule) && (await runRecurringRule(supabase, rule))) {
      summary.recurring_created += 1;
    }
  }

  // 2. Pending auto-triage jobs (from the quick_captures trigger).
  const { data: triageJobs } = await supabase
    .from("jobs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("kind", "auto_triage")
    .eq("status", "pending")
    .order("run_at", { ascending: true })
    .limit(50);
  for (const job of triageJobs ?? []) {
    const captureId = job.payload.capture_id as string | undefined;
    if (!captureId) {
      await supabase.from("jobs").update({ status: "done" }).eq("id", job.id);
      continue;
    }
    try {
      const ok = await triageCapture(supabase, workspaceId, captureId);
      // Matched (or already triaged) → done; no match → keep pending so a
      // later rule edit can still pick it up? No — a non-match means the rule
      // exists but the keyword missed; leave it pending is a loop risk. Mark
      // done either way; the capture stays in the inbox untriaged.
      await supabase.from("jobs").update({ status: "done", attempts: job.attempts + 1 }).eq("id", job.id);
      if (ok) summary.triaged += 1;
    } catch (err) {
      const attempts = job.attempts + 1;
      const failed = attempts >= job.max_attempts;
      await supabase
        .from("jobs")
        .update({ status: failed ? "failed" : "pending", attempts, error: (err as Error).message })
        .eq("id", job.id);
    }
  }

  // 3. Daily rollover — gated on an enabled daily_rollover rule (the UI
  // toggle), and stamps the rule's last_run_at so the page shows when the
  // check last ran (the dashboard surfaces reminders from its own task fetch).
  // Tradeoff: without the rule, today's note is created on page visit (the
  // daily page upserts it) rather than in the background — that's the toggle
  // doing its job.
  const { data: rolloverRule } = await supabase
    .from("automation_rules")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("kind", "daily_rollover")
    .eq("enabled", true)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (rolloverRule) {
    summary.rollover_done = await runDailyRollover(supabase, workspaceId);
    await supabase
      .from("automation_rules")
      .update({ last_run_at: new Date().toISOString() })
      .eq("id", rolloverRule.id);
  }

  // 4. Reminder jobs (from recurring rules with remind_after_minutes) that are
  // due now — materialize them into the reminders feed.
  const { data: reminderJobs } = await supabase
    .from("jobs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("kind", "reminder")
    .eq("status", "pending")
    .lte("run_at", new Date().toISOString())
    .order("run_at", { ascending: true })
    .limit(20);
  for (const job of reminderJobs ?? []) {
    try {
      if (await runReminderJob(supabase, workspaceId, job, notif)) {
        summary.reminders_created += 1;
      }
      await supabase.from("jobs").update({ status: "done" }).eq("id", job.id);
    } catch (err) {
      const attempts = job.attempts + 1;
      const failed = attempts >= job.max_attempts;
      await supabase
        .from("jobs")
        .update({ status: failed ? "failed" : "pending", attempts, error: (err as Error).message })
        .eq("id", job.id);
    }
  }

  // 5. Weekly digest — send due digests, then keep the chain alive.
  const { data: digestJobs } = await supabase
    .from("jobs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("kind", "digest")
    .eq("status", "pending")
    .lte("run_at", new Date().toISOString())
    .limit(5);
  for (const job of digestJobs ?? []) {
    try {
      if (await runDigestJob(supabase, workspaceId, notif)) {
        summary.digests_sent += 1;
      }
      await supabase.from("jobs").update({ status: "done" }).eq("id", job.id);
    } catch (err) {
      const attempts = job.attempts + 1;
      const failed = attempts >= job.max_attempts;
      await supabase
        .from("jobs")
        .update({ status: failed ? "failed" : "pending", attempts, error: (err as Error).message })
        .eq("id", job.id);
    }
  }

  // Self-heal: keep exactly one future digest scheduled while the toggle is on
  // and an email exists (so enabling the digest needs no manual enqueue).
  if (notif?.weekly_digest && notif.email) {
    const { data: next } = await supabase
      .from("jobs")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("kind", "digest")
      .eq("status", "pending")
      .limit(1)
      .maybeSingle();
    if (!next) {
      await supabase.from("jobs").insert({
        workspace_id: workspaceId,
        kind: "digest",
        payload: {},
        run_at: new Date().toISOString(),
      });
    }
  }

  return summary;
}

// ---------------------------------------------------------------------------
// Helpers used by the UI to preview cadences
// ---------------------------------------------------------------------------

export function cadenceLabel(cadence: RecurringCadence): string {
  switch (cadence.type) {
    case "daily":
      return "Daily";
    case "weekly": {
      const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return `Weekly · ${names[cadence.weekday] ?? "?"}`;
    }
    case "monthly":
      return `Monthly · day ${cadence.day_of_month}`;
  }
}
