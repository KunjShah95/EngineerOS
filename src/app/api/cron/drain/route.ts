import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { drainAutomation, type DrainSummary } from "@/lib/automation";
import { log } from "@/lib/logger";

// Pro allows up to 300s; Hobby caps at 10s. The per-workspace drain is a
// handful of queries, and the loop below stops at a Hobby-safe budget anyway —
// remaining work is picked up by the next run (the queue is idempotent).
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Stay under the 10s Hobby limit so a single over-budget run can't be killed
// mid-workspace. Work left over is idempotently re-processed next run.
const TIME_BUDGET_MS = 9_000;

export async function GET(request: Request) {
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when the
  // CRON_SECRET env var is set. Without a secret configured, refuse to run.
  // Plain compare is fine here (Vercel's own docs do the same): the secret is
  // a long random server-side string, so timing correlation buys nothing.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    log("warn", "cron drain skipped — SUPABASE_SERVICE_ROLE_KEY not configured");
    return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });
  }

  // Service role bypasses RLS so the drain can reach every workspace (the
  // user-facing drain runs as the signed-in user; this one is cron-only).
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: workspaces, error } = await admin.from("workspaces").select("id");
  if (error) {
    log("error", "cron drain — workspace lookup failed", { error: error.message });
    return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  }

  const started = Date.now();
  let drained = 0;
  const total: DrainSummary = {
    recurring_created: 0,
    triaged: 0,
    rollover_done: false,
    reminders_created: 0,
    digests_sent: 0,
  };

  // NOTE on concurrency: this cron can overlap the client-side drain (load +
  // visibility interval, possibly several tabs). runRecurringRule's select→
  // insert→stamp is not atomic, so two overlapping drains could both create a
  // task for the same due rule — a tiny, non-destructive duplicate for a
  // single-user V1 workspace (the reminders feed is already guarded by its
  // job_id unique key). Accepted for now; if multi-tab/multi-device grows,
  // add a DB-level guard (e.g. unique (rule_id, run_period) or an advisory
  // lock in a security-definer function).
  for (const workspace of workspaces ?? []) {
    if (Date.now() - started > TIME_BUDGET_MS) break;
    try {
      const result = await drainAutomation(admin, workspace.id);
      drained += 1;
      total.recurring_created += result.recurring_created;
      total.triaged += result.triaged;
      total.rollover_done = total.rollover_done || result.rollover_done;
      total.reminders_created += result.reminders_created;
      total.digests_sent += result.digests_sent;
    } catch (err) {
      // One workspace failing must not abort the rest; the next run retries it.
      log("error", "cron drain — workspace failed", {
        workspace: workspace.id,
        error: (err as Error).message,
      });
    }
  }

  log("info", "cron drain complete", { drained, ...total });
  return NextResponse.json({ ok: true, drained, total });
}
