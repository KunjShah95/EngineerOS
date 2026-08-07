# Calendar Events — Phase 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.
>
> **Status note:** this plan was written **after** the implementation shipped in the calendar-events session (commits `688c83f`, `cbc2888`, `031c6da`, `a3e50fb`, plus review fix `edd8206`). The embedded code matches the **reviewed final state of the repo**, not a hypothetical pre-implementation snapshot. Phase 3 (recurrence) lines that predate this phase remain unmarked; the hardening fixes from `edd8206` (`syncEventReminder` delete-error check) are included.

**Goal:** Add **reminders** to calendar events, Google-Calendar style, riding the automation machinery that already exists for task reminders. An event carries `remind_minutes` (already created, dormant, by the Phase 1 migration); saving an event enqueues a **`reminder` job** on the existing durable `jobs` queue; the existing automation drain materializes due jobs into the in-app `reminders` feed (and mirrors to email when configured). No new cron, no new job kind — the whole Phase 10 drain pipeline is reused as-is.

**Architecture:** The event reminder path is a thin layer over the shipped task-reminder path:
1. **Migration** adds `reminders.event_id` (FK → `events.id` on delete cascade) so already-fired reminders for an event vanish with it.
2. **`useEvents`** gains `syncEventReminder`, wired into create/update/delete: it deletes any not-yet-fired `reminder` job for the event (jsonb `payload->>event_id` filter) and enqueues a fresh one at `starts_at − remind_minutes` — so creating, editing (including drag-moves, which only send `starts_at`/`ends_at`), and deleting all keep the job in sync. Client inserts/delete on `jobs` are allowed by existing RLS (`members can insert/delete jobs` — `is_workspace_member`).
3. **`runReminderJob`** in `src/lib/automation.ts` gets an **event branch** before the existing task branch: it verifies the event still exists (non-deleted), materializes the reminder row with `event_id`, and mirrors to email at `/calendar?event=<id>`. Deleted/soft-deleted events drop the job silently, exactly like the task path.
4. **UI:** a Reminder select in the event editor (None / 10m / 30m / 1h / 1d), and the notification panel deep-links event reminders to `/calendar?event=<id>` — a URL-driven editor (derived state, no `setState`-in-effect, which the repo's lint config bans).

No enum migration (the `reminder` kind already exists), no new table, no new dependency.

**Tech Stack:** Next.js (App Router), React Query, Supabase JS client, shadcn/ui (`Select`, `Input`, `Label`), `sonner`, `lucide-react`, vitest (with the existing in-memory supabase fake in `automation.test.ts`). No new dependencies.

---

## File Structure

**Create:**
- `supabase/migrations/20260807000002_event_reminders.sql` — `reminders.event_id` column + FK + index.

**Modify:**
- `src/types/database.ts` — add `event_id: string | null` to `ReminderRow`.
- `src/lib/automation.ts` — event branch at the top of `runReminderJob`.
- `src/lib/automation.test.ts` — 3 new event-reminder tests (reuse the `reminderJob` fixture with an `event_id` payload override).
- `src/hooks/useEvents.ts` — `syncEventReminder` helper; wire into `useCreateEvent`, `useUpdateEvent`, `useDeleteEvent`; `remind_minutes` in `EventInput` (already present from Phase 3).
- `src/components/calendar/EventEditorModal.tsx` — Reminder select (`REMINDER_OPTIONS`), state, submit serialization with the "already started" guard.
- `src/components/shell/NotificationPanel.tsx` — `event_id` branch linking to `/calendar?event=…`.
- `src/components/calendar/CalendarPage.tsx` — URL-driven editor: `openEventId` param, derived `deepLinkedEvent`, `openEvent` / `clearEventParam` / `closeEditor`.

**Delete:** none.

**Untouched by design:** the drain loop in `drainAutomation` (already selects pending `reminder` jobs due now); the `reminders` RLS (member read/insert/update/delete, Phase 10); the `jobs` RLS; `email.ts` (`renderReminderEmail`, `isEmailConfigured`, `sendEmail`); `useAutomation.ts` (`useReminders`, `useMarkReminderRead`); `EventInstance`/recurrence engine (Phase 3).

## Design decisions

- **Reuse the `reminder` job kind** with a `payload.event_id` — no enum migration, and the drain's existing "due now, pending, limit 20" query picks event jobs up with zero changes. `runReminderJob`'s idempotency guard (`reminders.job_id` unique) covers both kinds.
- **Sync = delete-then-insert, and bail on delete failure.** `syncEventReminder` deletes all pending `reminder` jobs for the event, then inserts one fresh job. If the **delete errors, it returns without inserting** — a stale job firing once at the old time is better than two pending jobs materializing duplicate reminders. (This guard is the `edd8206` review fix.)
- **`payload->>event_id` jsonb filter:** PostgREST resolves `.eq("payload->>event_id", id)` to the jsonb accessor `payload->>event_id` — the shipped code relies on this; the fake in `automation.test.ts` doesn't exercise it (only the drain path is unit-tested, not the hook).
- **Only pending jobs are touched.** A fired job's reminder row is already materialized and cannot be unsent; deleting the event cascades those rows away via the new FK.
- **`runReminderJob` event branch mirrors the task branch exactly:** verify target exists and is not soft-deleted → drop silently otherwise; insert with `.single()` and **throw on error so the drain retries**; email mirror is best-effort after the insert (deep link `/calendar?event=<id>`).
- **URL-driven editor (not state-synced):** `?event=` in the URL drives the modal (`deepLinkedEvent` is derived from `events` + the param; `editorOpen` only covers create). This avoids `setState`-in-`useEffect` (banned by the repo's `react-hooks/set-state-in-effect` rule) and makes notification deep links work on hard navigation.
- **Reminder before an already-started event never fires** — the modal drops it with an info toast (`"Reminder skipped — the event has already started"`) rather than saving a job that would be enqueued-past-due.
- **Resync triggers:** create (always), update (when the patch touches `remind_minutes`, `starts_at` — includes drag-moves — or `title`), delete (clear pending jobs before soft-delete).
- **Known v1 limitation (accepted):** recurring series get **one reminder at the series start** (`expandEvent` is read-time; there's no per-instance scheduling). Per-occurrence reminders are deferred.
- **RLS check:** client `jobs` insert/delete are permitted by `members can insert/delete jobs` (`is_workspace_member`) from the Phase 10 migration — confirmed in `20260802000009_automation.sql`. No new policies needed.

---

## Task 1: Migration + types

**Files:**
- Create: `supabase/migrations/20260807000002_event_reminders.sql`
- Modify: `src/types/database.ts`

- [x] **Step 1: Create the migration**

Create `supabase/migrations/20260807000002_event_reminders.sql`:

```sql
-- Calendar event reminders — Phase 4 of calendar-events.
-- Run after 20260807000001_calendar_events.sql.
--
-- Links the materialized reminders feed to calendar events. Event reminder
-- jobs reuse the existing 'reminder' job kind with a payload.event_id (no
-- enum change); the drain materializes them into public.reminders, so in-app
-- + email notifications behave exactly like task reminders. Deleting an event
-- cascades its reminder rows via the FK below.
alter table public.reminders
  add column if not exists event_id uuid references public.events (id) on delete cascade;

create index if not exists reminders_event_idx on public.reminders (event_id);
```

The `reminders` table already has `rule_id` and `task_id` (both nullable) plus a unique `job_id` used for drain idempotency; `event_id` joins that family.

- [x] **Step 2: Add the type**

In `src/types/database.ts`, add the field to `ReminderRow`:

```ts
/** In-app reminder materialized by the drain from a due reminder job. */
export interface ReminderRow {
  id: string;
  workspace_id: string;
  /** Source job — unique, so drain processing is idempotent. */
  job_id: string;
  rule_id: string | null;
  task_id: string | null;
  event_id: string | null; // Phase 4 — calendar event reminders
  title: string;
  fire_at: string;
  read_at: string | null;
  created_at: string;
}
```

- [x] **Step 3: Verify**

```bash
npx supabase db lint --fail-on error   # or npm run db:lint
npm run typecheck
```

---

## Task 2: Event branch in the drain + tests

**Files:**
- Modify: `src/lib/automation.ts`
- Modify: `src/lib/automation.test.ts`

- [x] **Step 1: Extend `runReminderJob`**

In `src/lib/automation.ts`, insert the event branch at the top of `runReminderJob`, after the idempotency guard and before the task branch. Full final function:

```ts
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
  // Idempotency guard: a partial run may have created the row already.
  const { data: existing } = await supabase
    .from("reminders")
    .select("id")
    .eq("job_id", job.id)
    .maybeSingle();
  if (existing) return false;

  // Event reminder — enqueued by the calendar (payload.event_id). Verify the
  // event still exists, then materialize with the event link; a reminder for a
  // deleted series is dropped silently, like the task path below.
  const eventId = job.payload.event_id as string | undefined;
  if (eventId) {
    const { data: event } = await supabase
      .from("events")
      .select("id, title")
      .eq("id", eventId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!event) return false;

    const { error } = await supabase
      .from("reminders")
      .insert({
        workspace_id: workspaceId,
        job_id: job.id,
        event_id: eventId,
        title: event.title,
        fire_at: job.run_at,
      })
      .select("id")
      .single();
    if (error) throw error; // Let the drain retry this job.

    // Mirror to email when the workspace has one configured (best-effort).
    if (notif?.email && isEmailConfigured()) {
      await sendEmail({
        to: notif.email,
        subject: `Reminder: ${event.title}`,
        html: renderReminderEmail(event.title, `/calendar?event=${eventId}`, job.run_at),
      });
    }
    return true;
  }

  // --- existing task branch below (unchanged) ---
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
```

No changes to `drainAutomation` — its reminder loop (`kind = reminder`, `status = pending`, `run_at <= now`, `limit 20`) already picks up event jobs.

- [x] **Step 2: Add the tests**

Append to the reminders section of `src/lib/automation.test.ts` (after the existing task-reminder tests). The tests reuse the `reminderJob` fixture with a payload override; no fixture changes needed:

```ts
// --- event reminders (calendar events, Phase 4) -------------------------

it("materializes due event reminder jobs into the reminders feed", async () => {
  const db = new FakeDatabase();
  db.seed("events", [{ id: "event-1", workspace_id: WS, title: "Sprint planning", deleted_at: null }]);
  db.seed("jobs", [reminderJob({ payload: { event_id: "event-1" } })]);
  const summary = await run(db);
  expect(summary.reminders_created).toBe(1);
  const rows = db.rows("reminders");
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    workspace_id: WS,
    job_id: "job-1",
    event_id: "event-1",
    title: "Sprint planning",
  });
  // rule_id/task_id default to NULL in the schema — the engine doesn't set them.
  expect(db.rows("jobs")[0].status).toBe("done");
});

it("drops event reminder jobs whose event has been deleted", async () => {
  const db = new FakeDatabase();
  // No events seeded — the referenced event is gone.
  db.seed("jobs", [reminderJob({ payload: { event_id: "event-1" } })]);
  const summary = await run(db);
  expect(summary.reminders_created).toBe(0);
  expect(db.rows("reminders")).toHaveLength(0);
  expect(db.rows("jobs")[0].status).toBe("done");
});

it("drops event reminder jobs whose event has been soft-deleted", async () => {
  const db = new FakeDatabase();
  db.seed("events", [
    { id: "event-1", workspace_id: WS, title: "Sprint planning", deleted_at: new Date().toISOString() },
  ]);
  db.seed("jobs", [reminderJob({ payload: { event_id: "event-1" } })]);
  const summary = await run(db);
  expect(summary.reminders_created).toBe(0);
  expect(db.rows("reminders")).toHaveLength(0);
  expect(db.rows("jobs")[0].status).toBe("done");
});
```

Note: the shipped assertions deliberately omit `rule_id`/`task_id` from `toMatchObject` — the real DB defaults them to NULL, and the fake insert spreads only the payload the engine sets.

- [x] **Step 3: Verify**

```bash
npx vitest run src/lib/automation.test.ts
```

All 41 automation tests pass (3 new event-reminder tests among them).

---

## Task 3: `syncEventReminder` in `useEvents`

**Files:**
- Modify: `src/hooks/useEvents.ts`

- [x] **Step 1: Add the sync helper**

`remind_minutes` is already in `EventInput` (Phase 3). Add the helper below `useEvents`:

```ts
/**
 * Keep the event's reminder job in sync: drop any not-yet-fired reminder job
 * for the event, then enqueue a fresh one at `starts_at - remind_minutes` when
 * a reminder is set. Past-fire times are skipped (you can't be reminded about
 * an event that already started). Best-effort — the event write succeeds
 * either way; a failed enqueue just means the reminder won't fire.
 */
async function syncEventReminder(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  event: CalendarEvent,
): Promise<void> {
  // Pending jobs only: a fired job's reminder row is already materialized and
  // can't be unsent. The delete uses the jsonb accessor on the payload, which
  // PostgREST resolves to `payload->>event_id = <id>`. If the delete fails,
  // bail WITHOUT inserting: a stale job firing once at the old time is better
  // than two pending jobs materializing duplicate reminders.
  const { error: deleteError } = await supabase
    .from("jobs")
    .delete()
    .eq("kind", "reminder")
    .eq("status", "pending")
    .eq("payload->>event_id", event.id);
  if (deleteError) return;

  const remind = event.remind_minutes;
  if (!remind || remind <= 0) return;

  const runAt = new Date(new Date(event.starts_at).getTime() - remind * 60_000);
  if (runAt <= new Date()) return; // Event already started — nothing to schedule.

  try {
    await supabase.from("jobs").insert({
      workspace_id: workspaceId,
      kind: "reminder",
      payload: { event_id: event.id, title: event.title },
      run_at: runAt.toISOString(),
    });
  } catch {
    // Best-effort — the reminder just won't fire.
  }
}
```

- [x] **Step 2: Wire into the mutations**

`useCreateEvent` — after the insert returns the row:

```ts
      if (error) throw error;
      const event = data as CalendarEvent;
      await syncEventReminder(supabase, workspaceId!, event);
      return event;
```

`useUpdateEvent` — resync when anything the reminder depends on changed (the reminder itself, the start time — including drag-moves, which only send `starts_at`/`ends_at` — or the title shown in the notification):

```ts
      if (error) throw error;
      const event = data as CalendarEvent;
      // Resync when anything the reminder depends on changed — the reminder
      // itself, the start time (incl. drag-moves, which only send
      // starts_at/ends_at), or the title shown in the notification.
      if (
        patch.remind_minutes !== undefined ||
        patch.starts_at !== undefined ||
        patch.title !== undefined
      ) {
        await syncEventReminder(supabase, workspaceId!, event);
      }
      return event;
```

`useDeleteEvent` — clear pending jobs before the soft-delete (already-fired rows cascade via the FK):

```ts
      // Clear any not-yet-fired reminder job for the event; already-fired
      // reminders cascade away via the reminders.event_id FK on delete.
      await supabase
        .from("jobs")
        .delete()
        .eq("kind", "reminder")
        .eq("status", "pending")
        .eq("payload->>event_id", id);
      const { error } = await supabase
        .from("events")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
```

- [x] **Step 3: Verify**

```bash
npm run typecheck
npx eslint src/hooks/useEvents.ts
```

---

## Task 4: Editor UI + notification deep links

**Files:**
- Modify: `src/components/calendar/EventEditorModal.tsx`
- Modify: `src/components/shell/NotificationPanel.tsx`
- Modify: `src/components/calendar/CalendarPage.tsx`

- [x] **Step 1: Reminder select in the editor**

In `src/components/calendar/EventEditorModal.tsx`:

Add the options constant (module scope, next to `COLORS`):

```ts
const REMINDER_OPTIONS: { label: string; minutes: number | null }[] = [
  { label: "None", minutes: null },
  { label: "10 minutes before", minutes: 10 },
  { label: "30 minutes before", minutes: 30 },
  { label: "1 hour before", minutes: 60 },
  { label: "1 day before", minutes: 1440 },
];
```

Add state (with the other `useState` calls):

```ts
  // Reminder (Phase 4) — minutes before start; enqueued as a job by useEvents.
  const [remindMinutes, setRemindMinutes] = useState<number | null>(event?.remind_minutes ?? null);
```

Serialize in `submit`, with the "already started" guard before building `payload` (a reminder for a started event can never fire — drop it rather than save a job that silently never goes off):

```ts
    // A reminder before an already-started event can never fire — drop it so
    // the event doesn't read as "has a reminder" that silently never goes off.
    let remind = remindMinutes;
    if (remind && new Date(startsAt).getTime() - remind * 60_000 <= Date.now()) {
      remind = null;
      toast.info("Reminder skipped — the event has already started");
    }
```

Add `remind_minutes: remind` to the `payload` object (alongside the Phase 3 `rrule_*` fields).

Add the UI block (between the start/end grid and the Repeats section):

```tsx
          {/* Reminder */}
          <div className="space-y-1.5">
            <Label>Reminder</Label>
            <Select
              value={String(remindMinutes ?? 0)}
              onValueChange={(v) => setRemindMinutes(v === "0" ? null : Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REMINDER_OPTIONS.map((o) => (
                  <SelectItem key={o.minutes ?? 0} value={String(o.minutes ?? 0)}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
```

- [x] **Step 2: Notification deep link**

In `src/components/shell/NotificationPanel.tsx`, add the `event_id` branch before the fallback span (sibling of the existing `task_id` branch):

```tsx
                {r.task_id ? (
                  <Link
                    href={`/tasks?task=${r.task_id}`}
                    onClick={() => setOpen(false)}
                    className="truncate font-medium text-foreground hover:text-accent"
                  >
                    {r.title}
                  </Link>
                ) : r.event_id ? (
                  <Link
                    href={`/calendar?event=${r.event_id}`}
                    onClick={() => setOpen(false)}
                    className="truncate font-medium text-foreground hover:text-accent"
                  >
                    {r.title}
                  </Link>
                ) : (
                  <span className="truncate font-medium">{r.title}</span>
                )}
```

- [x] **Step 3: URL-driven editor in CalendarPage**

In `src/components/calendar/CalendarPage.tsx`, the `?event=` search param drives the editor — modal state is **derived** from the param, never mirrored with `setState` in an effect (the repo's `react-hooks/set-state-in-effect` rule bans that pattern; deriving also makes deep links work on hard navigation).

Read the param and derive the event:

```ts
  const openEventId = searchParams.get("event");
  ...
  // Deep link from a notification: ?event= in the URL drives the editor, so
  // the modal state is derived from the param rather than mirrored in state.
  const deepLinkedEvent = openEventId
    ? (events ?? []).find((e) => e.id === openEventId) ?? null
    : null;
```

Clear/set helpers and the create path (create state is local; opening a create **clears** the param first so the two don't collide):

```ts
  const clearEventParam = () => {
    if (!openEventId) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("event");
    router.replace(`/calendar${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const openEvent = (id: string) => {
    // The ?event= param drives the editor (see deepLinkedEvent above).
    const params = new URLSearchParams(searchParams.toString());
    params.set("event", id);
    router.replace(`/calendar?${params.toString()}`);
  };

  const openCreateAt = (iso: string, startMinutes: number, endMinutes: number) => {
    clearEventParam();
    setEditorEvent(null);
    setCreateStart(minutesToLocalInput(iso, startMinutes));
    setCreateEnd(minutesToLocalInput(iso, endMinutes));
    setEditorOpen(true);
  };

  const newEvent = () => {
    clearEventParam();
    setEditorEvent(null);
    setCreateStart(`${todayISO}T09:00`);
    setCreateEnd(`${todayISO}T10:00`);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    clearEventParam();
    setEditorOpen(false);
    setEditorEvent(null);
    setCreateStart(null);
    setCreateEnd(null);
  };
```

Render the modal when either a deep link is present or a create is open:

```tsx
      {(deepLinkedEvent !== null || editorOpen) && (
        <EventEditorModal
          workspaceId={workspace.id}
          event={deepLinkedEvent ?? editorEvent}
          initialStart={createStart}
          initialEnd={createEnd}
          onClose={closeEditor}
        />
      )}
```

- [x] **Step 4: Verify**

```bash
npm run typecheck
npx eslint src/components/calendar/EventEditorModal.tsx src/components/shell/NotificationPanel.tsx src/components/calendar/CalendarPage.tsx
```

---

## Task 5: Full validation

- [x] **Step 1: Run the full test suite**

Run: `npx vitest run` — 127 tests pass (3 new event-reminder tests among them).

- [x] **Step 2: Typecheck + lint + build**

```bash
npm run typecheck
npx eslint src/lib/automation.ts src/lib/automation.test.ts src/hooks/useEvents.ts src/components/calendar/EventEditorModal.tsx src/components/shell/NotificationPanel.tsx src/components/calendar/CalendarPage.tsx src/types/database.ts
npm run build
```

All clean.

---

## Task 6: Manual UAT

Run: `npm run dev`. Open `/calendar` (needs the local Supabase stack + the Phase 1 `events` migration + this migration applied).

- [ ] **Step 1: Create with a reminder**

Create an event 20 minutes out, set **Reminder: 10 minutes before** → Save. Wait ~1 minute, trigger the drain (reload the dashboard), and the reminder appears in the notification panel (bell) at the expected time. The deep link opens the event editor on `/calendar?event=<id>`.

- [ ] **Step 2: Re-time on a drag-move**

Create an event with a reminder, then drag it to a later slot on the hour grid. The pending `jobs` row's `run_at` should reflect the new start (check via the Supabase Studio `jobs` table).

- [ ] **Step 3: Remove the reminder**

Edit the same event → **Reminder: None** → Save. The pending job is gone from `jobs`; no reminder fires.

- [ ] **Step 4: Already-started guard**

Edit an event that started in the past → pick a reminder → Save. A toast says "Reminder skipped — the event has already started", and `remind_minutes` saves as null.

- [ ] **Step 5: Delete cascades**

Create an event with a reminder and let it fire. Delete the event → the reminder row is gone from `reminders` (FK cascade) and no pending job remains.

- [ ] **Step 6: Email mirror (optional)**

Set a workspace email + configure `RESEND_API_KEY`-style email (see `src/lib/email.ts`) → a fired event reminder sends an email linking to `/calendar?event=<id>`.

- [ ] **Step 7: Recurring series caveat**

Create a weekly recurring event with a reminder → exactly one reminder fires at the series start (known v1 limitation, per the spec).

---

## Self-Review Notes

- **Spec coverage:** reminders via `remind_minutes` ✓ (Task 1 column dormant since Phase 1, Task 3 enqueue, Task 4 UI); existing job queue reused — no new cron ✓; in-app + email behavior matches task reminders ✓ (Task 2). The spec's "reminders ride the existing jobs queue" decision is implemented literally.
- **Consistency:** the event branch in `runReminderJob` mirrors the task branch (verify → insert with `.single()` → throw on error → best-effort email); `syncEventReminder` follows the repo's best-effort-write pattern; React Query invalidation unchanged; shadcn `Select`/`Label` and `sonner` toasts reused.
- **Review fixes baked in:** `syncEventReminder` checks the delete's error and bails instead of risking duplicate pending jobs (`edd8206`); `rule_id`/`task_id` dropped from the test's `toMatchObject` (the real DB defaults them to NULL, so asserting them would fail at execution time); CalendarPage derives editor state from the URL param instead of `setState`-in-effect (lint-banned pattern).
- **Known intentional intermediate failures:** none — Tasks 1–4 each leave the tree typechecking.
- **RLS / security:** client `jobs` insert/delete ride existing `members can insert/delete jobs` policies; `reminders` rows are member-readable; emails only go to the workspace owner's configured address (existing `getNotificationSettings` behavior — members get null and silently skip email, intended).
- **Edge cases covered (tested):** event exists → materialize; event deleted → drop; event soft-deleted → drop; drain idempotency (existing tests); pending-only sync; past-fire skip; delete-error bail; FK cascade.
- **Known v1 limitations:** one reminder per series at the series start (no per-occurrence reminders for recurring events); no custom reminder offset beyond the five presets; reminders are in-app (+email if configured) only — no push/OS notifications.

