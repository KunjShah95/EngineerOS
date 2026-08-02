// Unit tests for the Phase 10 automation engine (src/lib/automation.ts).
//
// The engine takes a Supabase client via dependency injection, so we drive it
// with an in-memory fake that mirrors the supabase-js fluent API
// (from/select/insert/update/delete/upsert + eq/is/order/limit +
// single/maybeSingle). The fake records every operation, which lets the
// rollback tests assert exact write/delete sequences, and supports injected
// failures (returned errors or network-style rejections) for the retry paths.
//
// One deliberate deviation from supabase-js: bare update()/insert() return the
// affected rows here, whereas real supabase returns { data: null } unless
// .select() is chained. Harmless for the engine (it only reads `error` from
// updates and always chains .select() on inserts), but worth knowing if this
// fake is ever reused for code that asserts on those data payloads.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addDays, format } from "date-fns";

import { cadenceLabel, drainAutomation, nextRecurringRun } from "@/lib/automation";

// ---------------------------------------------------------------------------
// In-memory supabase fake
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;
type Filter = { col: string; val: unknown; op?: "eq" | "is" | "lte" | "gte" | "not_is" };
type OpAction = "select" | "insert" | "update" | "delete" | "upsert";

interface Op {
  table: string;
  action: OpAction;
  payload: Row | null;
  filters: Filter[];
}

interface FailRule {
  table: string;
  action: OpAction;
  /** Optional predicate on the op; absent = match any op for table+action. */
  match?: (op: Op) => boolean;
  error: string;
  /** When true, the op rejects (network-style failure) instead of returning an error row. */
  reject?: boolean;
}

type Result = { data: Row[] | Row | null; error: Error | null };

function project(row: Row, cols: string): Row {
  if (cols === "*") return row;
  const out: Row = {};
  for (const col of cols.split(",")) {
    const c = col.trim();
    if (c && c in row) out[c] = row[c];
  }
  return out;
}

class FakeDatabase {
  private data: Record<string, Row[]> = {};
  private failures: FailRule[] = [];
  readonly ops: Op[] = [];

  seed(table: string, rows: Row[]): void {
    this.data[table] = [...(this.data[table] ?? []), ...rows];
  }

  rows(table: string): Row[] {
    return this.data[table] ?? [];
  }

  fail(rule: FailRule): void {
    this.failures.push(rule);
  }

  recordOp(op: Op): void {
    this.ops.push(op);
  }

  findFailure(op: Op): FailRule | undefined {
    return this.failures.find(
      (f) => f.table === op.table && f.action === op.action && (!f.match || f.match(op)),
    );
  }

  addRow(table: string, row: Row): void {
    (this.data[table] ??= []).push(row);
  }

  deleteRows(table: string, keep: (row: Row) => boolean): void {
    this.data[table] = (this.data[table] ?? []).filter(keep);
  }

  from(table: string): FakeQueryBuilder {
    return new FakeQueryBuilder(this, table);
  }
}

class FakeQueryBuilder {
  private filters: Filter[] = [];
  private limitN: number | null = null;
  private orderBy: { col: string; asc: boolean } | null = null;
  private mode: OpAction = "select";
  private payload: Row | null = null;
  private upsertOpts: { onConflict?: string; ignoreDuplicates?: boolean } = {};
  private selectCols: string | null = null;

  constructor(
    private readonly db: FakeDatabase,
    private readonly table: string,
  ) {}

  select(cols = "*"): this {
    this.selectCols = cols;
    return this;
  }

  insert(payload: Row): this {
    this.mode = "insert";
    this.payload = payload;
    return this;
  }

  update(payload: Row): this {
    this.mode = "update";
    this.payload = payload;
    return this;
  }

  delete(): this {
    this.mode = "delete";
    return this;
  }

  upsert(payload: Row, opts: { onConflict?: string; ignoreDuplicates?: boolean } = {}): this {
    this.mode = "upsert";
    this.payload = payload;
    this.upsertOpts = opts;
    return this;
  }

  eq(col: string, val: unknown): this {
    this.filters.push({ col, val });
    return this;
  }

  is(col: string, val: unknown): this {
    this.filters.push({ col, val, op: "is" });
    return this;
  }

  lte(col: string, val: unknown): this {
    this.filters.push({ col, val, op: "lte" });
    return this;
  }

  gte(col: string, val: unknown): this {
    this.filters.push({ col, val, op: "gte" });
    return this;
  }

  not(col: string, operator: string, val: unknown): this {
    this.filters.push({ col, val, op: operator === "is" ? "not_is" : "eq" });
    return this;
  }

  order(col: string, opts: { ascending?: boolean } = {}): this {
    this.orderBy = { col, asc: opts.ascending ?? true };
    return this;
  }

  limit(n: number): this {
    this.limitN = n;
    return this;
  }

  single(): PromiseLike<Result> {
    return new SingleResult(this, "single");
  }

  maybeSingle(): PromiseLike<Result> {
    return new SingleResult(this, "maybe");
  }

  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  async execute(): Promise<Result> {
    const op: Op = {
      table: this.table,
      action: this.mode,
      payload: this.payload,
      filters: [...this.filters],
    };
    this.db.recordOp(op);
    const failure = this.db.findFailure(op);
    if (failure) {
      const err = new Error(failure.error);
      if (failure.reject) throw err;
      return { data: null, error: err };
    }

    const matches = (r: Row): boolean =>
      this.filters.every((f) => {
        const rv = r[f.col];
        if (f.op === "lte") return (rv as string) <= (f.val as string);
        if (f.op === "gte") return (rv as string) >= (f.val as string);
        if (f.op === "not_is") return (rv ?? null) !== (f.val ?? null);
        if (f.op === "is" || f.val === null) return (rv ?? null) === (f.val ?? null);
        return rv === f.val;
      });

    switch (this.mode) {
      case "select": {
        let rows = this.db.rows(this.table).filter(matches);
        if (this.orderBy) {
          const { col, asc } = this.orderBy;
          rows = [...rows].sort((a, b) => {
            const av = a[col];
            const bv = b[col];
            if (av == null) return 1;
            if (bv == null) return -1;
            return (av < bv ? -1 : av > bv ? 1 : 0) * (asc ? 1 : -1);
          });
        }
        if (this.limitN != null) rows = rows.slice(0, this.limitN);
        const projected = this.selectCols ? rows.map((r) => project(r, this.selectCols!)) : rows;
        return { data: projected, error: null };
      }
      case "insert": {
        const rows = this.payload ? [this.payload] : [];
        const inserted: Row[] = [];
        for (const row of rows) {
          const rec = { ...row };
          if (!rec.id) rec.id = crypto.randomUUID();
          this.db.addRow(this.table, rec);
          inserted.push(rec);
        }
        const out = this.selectCols ? inserted.map((r) => project(r, this.selectCols!)) : inserted;
        return { data: out, error: null };
      }
      case "update": {
        const matched: Row[] = [];
        for (const row of this.db.rows(this.table)) {
          if (matches(row)) {
            Object.assign(row, this.payload);
            matched.push(row);
          }
        }
        return { data: matched, error: null };
      }
      case "delete":
        this.db.deleteRows(this.table, (r) => !matches(r));
        return { data: null, error: null };
      case "upsert": {
        const conflictCols = (this.upsertOpts.onConflict ?? "id")
          .split(",")
          .map((s) => s.trim());
        const payload = (this.payload ?? {}) as Row;
        const existing = this.db
          .rows(this.table)
          .find((r) => conflictCols.every((c) => r[c] === payload[c]));
        if (existing && this.upsertOpts.ignoreDuplicates) {
          const out = this.selectCols ? [project(existing, this.selectCols!)] : [existing];
          return { data: out, error: null };
        }
        const rec = { ...(existing ?? {}), ...payload };
        if (!rec.id) rec.id = crypto.randomUUID();
        if (existing) Object.assign(existing, payload);
        else this.db.addRow(this.table, rec);
        const finalRow = existing ?? rec;
        const out = this.selectCols ? [project(finalRow, this.selectCols!)] : [finalRow];
        return { data: out, error: null };
      }
      default:
        return { data: null, error: null };
    }
  }
}

class SingleResult {
  constructor(
    private readonly qb: FakeQueryBuilder,
    private readonly mode: "single" | "maybe",
  ) {}

  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<Result> {
    const base = await this.qb.execute();
    if (base.error) return base;
    const rows = base.data ? (Array.isArray(base.data) ? base.data : [base.data]) : [];
    if (rows.length === 0) {
      if (this.mode === "maybe") return { data: null, error: null };
      return { data: null, error: new Error("row not found") };
    }
    if (rows.length > 1) return { data: null, error: new Error("more than one row") };
    return { data: rows[0], error: null };
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WS = "ws-1";

function recurringRule(overrides: Partial<Row> = {}): Row {
  return {
    id: "rule-1",
    workspace_id: WS,
    kind: "recurring_task",
    name: "Weekly review",
    config: { title: "Weekly review", cadence: { type: "daily" } },
    enabled: true,
    last_run_at: null,
    deleted_at: null,
    ...overrides,
  };
}

function triageRule(overrides: Partial<Row> = {}): Row {
  return {
    id: "triage-1",
    workspace_id: WS,
    kind: "auto_triage",
    name: "Triage",
    config: {
      rules: [
        { match: "todo:", action: "task", project_id: null },
        { match: "note:", action: "note", project_id: null },
      ],
    },
    enabled: true,
    last_run_at: null,
    deleted_at: null,
    ...overrides,
  };
}

function rolloverRule(overrides: Partial<Row> = {}): Row {
  return {
    id: "roll-1",
    workspace_id: WS,
    kind: "daily_rollover",
    name: "Rollover",
    config: {},
    enabled: true,
    last_run_at: null,
    deleted_at: null,
    ...overrides,
  };
}

function job(overrides: Partial<Row> = {}): Row {
  return {
    id: "job-1",
    workspace_id: WS,
    kind: "auto_triage",
    status: "pending",
    attempts: 0,
    max_attempts: 3,
    error: null,
    payload: { capture_id: "cap-1" },
    run_at: new Date().toISOString(),
    ...overrides,
  };
}

function reminderJob(overrides: Partial<Row> = {}): Row {
  return {
    id: "job-1",
    workspace_id: WS,
    kind: "reminder",
    status: "pending",
    attempts: 0,
    max_attempts: 3,
    error: null,
    payload: { rule_id: "rule-1", task_id: "task-1", title: "Weekly review" },
    run_at: new Date(Date.now() - 60_000).toISOString(), // due now
    ...overrides,
  };
}

function capture(overrides: Partial<Row> = {}): Row {
  return {
    id: "cap-1",
    workspace_id: WS,
    raw_text: "todo: fix auth bug",
    triaged_into: null,
    triaged_id: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// nextRecurringRun
// ---------------------------------------------------------------------------

describe("nextRecurringRun", () => {
  it("returns now when the rule has never run", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 2, 9, 0, 0));
    try {
      expect(nextRecurringRun(null, { type: "daily" })).toEqual(new Date(2026, 7, 2, 9, 0, 0));
    } finally {
      vi.useRealTimers();
    }
  });

  it("daily advances by exactly one day, across a month boundary", () => {
    expect(nextRecurringRun(new Date(2026, 0, 31, 10, 0, 0), { type: "daily" })).toEqual(
      new Date(2026, 1, 1, 10, 0, 0),
    );
  });

  it("weekly returns the next occurrence of the target weekday", () => {
    // Mon 2026-08-03 → next Monday 2026-08-10.
    expect(nextRecurringRun(new Date(2026, 7, 3, 9, 0, 0), { type: "weekly", weekday: 1 })).toEqual(
      new Date(2026, 7, 10, 9, 0, 0),
    );
    // Fri 2026-08-07 → Sunday 2026-08-09 (same week, wraps from the end).
    expect(nextRecurringRun(new Date(2026, 7, 7, 9, 0, 0), { type: "weekly", weekday: 0 })).toEqual(
      new Date(2026, 7, 9, 9, 0, 0),
    );
    // Fri 2026-08-07 → Monday 2026-08-10.
    expect(nextRecurringRun(new Date(2026, 7, 7, 9, 0, 0), { type: "weekly", weekday: 1 })).toEqual(
      new Date(2026, 7, 10, 9, 0, 0),
    );
  });

  it("monthly clamps days beyond 28 to the end of February", () => {
    expect(nextRecurringRun(new Date(2026, 0, 15, 9, 0, 0), { type: "monthly", day_of_month: 31 })).toEqual(
      new Date(2026, 1, 28, 9, 0, 0),
    );
    expect(nextRecurringRun(new Date(2026, 0, 31, 9, 0, 0), { type: "monthly", day_of_month: 28 })).toEqual(
      new Date(2026, 1, 28, 9, 0, 0),
    );
  });

  it("monthly keeps the target day for valid values", () => {
    expect(nextRecurringRun(new Date(2026, 0, 10, 9, 0, 0), { type: "monthly", day_of_month: 15 })).toEqual(
      new Date(2026, 1, 15, 9, 0, 0),
    );
  });
});

// ---------------------------------------------------------------------------
// cadenceLabel
// ---------------------------------------------------------------------------

describe("cadenceLabel", () => {
  it("labels each cadence kind", () => {
    expect(cadenceLabel({ type: "daily" })).toBe("Daily");
    expect(cadenceLabel({ type: "weekly", weekday: 1 })).toBe("Weekly · Mon");
    expect(cadenceLabel({ type: "monthly", day_of_month: 15 })).toBe("Monthly · day 15");
  });
});

// ---------------------------------------------------------------------------
// drainAutomation
// ---------------------------------------------------------------------------

describe("drainAutomation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 2, 9, 0, 0)); // 2026-08-02 09:00 local
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const today = () => format(new Date(), "yyyy-MM-dd");
  const yesterday = () => format(addDays(new Date(), -1), "yyyy-MM-dd");
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
  const daysAhead = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

  const run = (db: FakeDatabase) =>
    drainAutomation(db as unknown as Parameters<typeof drainAutomation>[0], WS);

  // --- recurring tasks ----------------------------------------------------

  it("returns a zeroed summary when there is nothing to do", async () => {
    const db = new FakeDatabase();
    expect(await run(db)).toEqual({
      recurring_created: 0,
      triaged: 0,
      rollover_done: false,
      reminders_created: 0,
      digests_sent: 0,
    });
  });

  it("creates a task for a due recurring rule and stamps last_run_at", async () => {
    const db = new FakeDatabase();
    db.seed("automation_rules", [recurringRule({ last_run_at: daysAgo(2) })]);
    const summary = await run(db);
    expect(summary.recurring_created).toBe(1);
    const tasks = db.rows("tasks");
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      workspace_id: WS,
      title: "Weekly review",
      status: "todo",
      due_date: today(),
    });
    expect(db.rows("automation_rules")[0].last_run_at).not.toBeNull();
  });

  it("creates a task for each due recurring rule", async () => {
    const db = new FakeDatabase();
    db.seed("automation_rules", [
      recurringRule({ id: "rule-a", last_run_at: daysAgo(2) }),
      recurringRule({ id: "rule-b", last_run_at: daysAgo(3) }),
    ]);
    const summary = await run(db);
    expect(summary.recurring_created).toBe(2);
    expect(db.rows("tasks")).toHaveLength(2);
  });

  it("skips recurring rules whose config has no cadence", async () => {
    const db = new FakeDatabase();
    db.seed("automation_rules", [recurringRule({ config: { title: "Broken" } })]);
    const summary = await run(db);
    expect(summary.recurring_created).toBe(0);
    expect(db.rows("tasks")).toHaveLength(0);
  });

  it("does not fire a rule whose next run is in the future", async () => {
    const db = new FakeDatabase();
    db.seed("automation_rules", [recurringRule({ last_run_at: daysAhead(1) })]);
    const summary = await run(db);
    expect(summary).toEqual({
      recurring_created: 0,
      triaged: 0,
      rollover_done: false,
      reminders_created: 0,
      digests_sent: 0,
    });
    expect(db.rows("tasks")).toHaveLength(0);
  });

  it("skips disabled recurring rules", async () => {
    const db = new FakeDatabase();
    db.seed("automation_rules", [recurringRule({ enabled: false })]);
    const summary = await run(db);
    expect(summary.recurring_created).toBe(0);
    expect(db.rows("tasks")).toHaveLength(0);
  });

  it("does not double-fire on a second drain", async () => {
    const db = new FakeDatabase();
    db.seed("automation_rules", [recurringRule({ last_run_at: daysAgo(2) })]);
    await run(db);
    await run(db);
    expect(db.rows("tasks")).toHaveLength(1);
  });

  it("does not stamp last_run_at when the task insert fails", async () => {
    const db = new FakeDatabase();
    db.seed("automation_rules", [recurringRule()]);
    db.fail({ table: "tasks", action: "insert", error: "insert failed" });
    const summary = await run(db);
    expect(summary.recurring_created).toBe(0);
    expect(db.rows("automation_rules")[0].last_run_at).toBeNull();
  });

  it("rolls back the created task when the last_run_at stamp fails", async () => {
    const db = new FakeDatabase();
    // remind_after_minutes is set, so the enqueue would run AFTER the stamp —
    // a stamp failure must leave NO orphan reminder job behind.
    db.seed("automation_rules", [
      recurringRule({ config: { title: "Weekly review", cadence: { type: "daily" }, remind_after_minutes: 30 } }),
    ]);
    db.fail({
      table: "automation_rules",
      action: "update",
      match: (op) => op.payload?.["last_run_at"] != null,
      error: "stamp failed",
    });
    const summary = await run(db);
    expect(summary.recurring_created).toBe(0);
    // The task was inserted then rolled back — no orphaned duplicate source.
    expect(db.rows("tasks")).toHaveLength(0);
    expect(db.rows("jobs")).toHaveLength(0); // no reminder job either
    expect(db.rows("automation_rules")[0].last_run_at).toBeNull();
    expect(db.ops.some((o) => o.table === "tasks" && o.action === "delete")).toBe(true);
  });

  // --- auto-triage --------------------------------------------------------

  it("auto-triages a capture into a task on keyword match", async () => {
    const db = new FakeDatabase();
    db.seed("automation_rules", [triageRule()]);
    db.seed("jobs", [job()]);
    db.seed("quick_captures", [capture()]);
    const summary = await run(db);
    expect(summary.triaged).toBe(1);
    expect(db.rows("tasks")).toHaveLength(1);
    expect(db.rows("tasks")[0]).toMatchObject({ workspace_id: WS, title: "todo: fix auth bug" });
    expect(db.rows("quick_captures")[0].triaged_into).toBe("task");
    expect(db.rows("jobs")[0].status).toBe("done");
  });

  it("auto-triages a capture into a note, truncating long titles", async () => {
    const db = new FakeDatabase();
    db.seed("automation_rules", [triageRule()]);
    db.seed("jobs", [job()]);
    db.seed("quick_captures", [capture({ raw_text: `note: ${"x".repeat(90)}` })]);
    const summary = await run(db);
    expect(summary.triaged).toBe(1);
    const notes = db.rows("notes");
    expect(notes).toHaveLength(1);
    expect(notes[0].title).toMatch(/^note: x{74}…$/);
  });

  it("leaves non-matching captures in the inbox", async () => {
    const db = new FakeDatabase();
    db.seed("automation_rules", [triageRule()]);
    db.seed("jobs", [job()]);
    db.seed("quick_captures", [capture({ raw_text: "call mom about dinner" })]);
    const summary = await run(db);
    expect(summary.triaged).toBe(0);
    expect(db.rows("tasks")).toHaveLength(0);
    expect(db.rows("notes")).toHaveLength(0);
    expect(db.rows("quick_captures")[0].triaged_into).toBeNull();
    expect(db.rows("jobs")[0].status).toBe("done");
  });

  it("completes jobs for already-triaged captures without over-counting", async () => {
    const db = new FakeDatabase();
    db.seed("automation_rules", [triageRule()]);
    db.seed("jobs", [job()]);
    db.seed("quick_captures", [capture({ triaged_into: "task", triaged_id: "t-9" })]);
    const summary = await run(db);
    expect(summary.triaged).toBe(0); // nothing was triaged by this run
    expect(db.rows("tasks")).toHaveLength(0);
    expect(db.rows("jobs")[0].status).toBe("done");
  });

  it("completes jobs that lack a capture reference", async () => {
    const db = new FakeDatabase();
    db.seed("jobs", [job({ payload: {} })]);
    const summary = await run(db);
    expect(summary.triaged).toBe(0);
    expect(db.rows("jobs")[0].status).toBe("done");
  });

  it("processes multiple pending triage jobs", async () => {
    const db = new FakeDatabase();
    db.seed("automation_rules", [triageRule()]);
    db.seed("jobs", [job({ id: "job-a" }), job({ id: "job-b", payload: { capture_id: "cap-2" } })]);
    db.seed("quick_captures", [capture(), capture({ id: "cap-2", raw_text: "note: remember x" })]);
    const summary = await run(db);
    expect(summary.triaged).toBe(2);
    expect(db.rows("tasks")).toHaveLength(1);
    expect(db.rows("notes")).toHaveLength(1);
  });

  it("rolls back the created task when the capture stamp fails", async () => {
    const db = new FakeDatabase();
    db.seed("automation_rules", [triageRule()]);
    db.seed("jobs", [job()]);
    db.seed("quick_captures", [capture()]);
    db.fail({
      table: "quick_captures",
      action: "update",
      match: (op) => op.payload?.["triaged_into"] != null,
      error: "stamp failed",
    });
    const summary = await run(db);
    expect(summary.triaged).toBe(0);
    expect(db.rows("tasks")).toHaveLength(0);
    expect(db.rows("quick_captures")[0].triaged_into).toBeNull();
    expect(db.ops.some((o) => o.table === "tasks" && o.action === "delete")).toBe(true);
  });

  it("rolls back the created note when the capture stamp fails", async () => {
    const db = new FakeDatabase();
    db.seed("automation_rules", [triageRule()]);
    db.seed("jobs", [job()]);
    db.seed("quick_captures", [capture({ raw_text: "note: remember the deploy" })]);
    db.fail({
      table: "quick_captures",
      action: "update",
      match: (op) => op.payload?.["triaged_into"] != null,
      error: "stamp failed",
    });
    const summary = await run(db);
    expect(summary.triaged).toBe(0);
    expect(db.rows("notes")).toHaveLength(0);
    expect(db.ops.some((o) => o.table === "notes" && o.action === "delete")).toBe(true);
  });

  it("increments attempts and fails jobs that exhaust max_attempts", async () => {
    const db = new FakeDatabase();
    db.seed("automation_rules", [triageRule()]);
    db.seed("jobs", [job({ attempts: 2, max_attempts: 3 })]);
    db.seed("quick_captures", [capture()]);
    db.fail({
      table: "automation_rules",
      action: "select",
      match: (op) => op.filters.some((f) => f.col === "kind" && f.val === "auto_triage"),
      error: "boom",
      reject: true,
    });
    const summary = await run(db);
    expect(summary.triaged).toBe(0);
    expect(db.rows("jobs")[0].status).toBe("failed");
    expect(db.rows("jobs")[0].attempts).toBe(3);
    expect(db.rows("jobs")[0].error).toBe("boom");
  });

  it("keeps a job pending for retry when it fails before max_attempts", async () => {
    const db = new FakeDatabase();
    db.seed("automation_rules", [triageRule()]);
    db.seed("jobs", [job({ attempts: 0, max_attempts: 5 })]);
    db.seed("quick_captures", [capture()]);
    db.fail({
      table: "automation_rules",
      action: "select",
      match: (op) => op.filters.some((f) => f.col === "kind" && f.val === "auto_triage"),
      error: "boom",
      reject: true,
    });
    await run(db);
    expect(db.rows("jobs")[0].status).toBe("pending");
    expect(db.rows("jobs")[0].attempts).toBe(1);
  });

  // --- daily rollover -----------------------------------------------------

  it("creates today's daily note and copies yesterday's Tomorrow into goals", async () => {
    const db = new FakeDatabase();
    db.seed("automation_rules", [rolloverRule()]);
    db.seed("daily_notes", [{ workspace_id: WS, date: yesterday(), tomorrow: "Ship the release notes" }]);
    const summary = await run(db);
    expect(summary.rollover_done).toBe(true);
    const notes = db.rows("daily_notes");
    expect(notes).toHaveLength(2); // yesterday (seeded) + today (created)
    const todayRow = notes.find((n) => n.date === today());
    expect(todayRow?.morning_goals).toBe("Ship the release notes");
    expect(db.rows("automation_rules")[0].last_run_at).not.toBeNull();
  });

  it("leaves existing Morning Goals untouched but still stamps the rule", async () => {
    const db = new FakeDatabase();
    db.seed("automation_rules", [rolloverRule()]);
    db.seed("daily_notes", [{ workspace_id: WS, date: today(), morning_goals: "Plan the sprint" }]);
    const summary = await run(db);
    expect(summary.rollover_done).toBe(false);
    const todayRow = db.rows("daily_notes").find((n) => n.date === today());
    expect(todayRow?.morning_goals).toBe("Plan the sprint");
    // The rollover path still executed (its rule was stamped).
    expect(db.rows("automation_rules")[0].last_run_at).not.toBeNull();
  });

  it("skips rollover entirely when no daily_rollover rule is enabled", async () => {
    const db = new FakeDatabase();
    const summary = await run(db);
    expect(summary.rollover_done).toBe(false);
    expect(db.rows("daily_notes")).toHaveLength(0);
    expect(db.ops.some((o) => o.table === "daily_notes")).toBe(false);
  });

  // --- reminders ----------------------------------------------------------

  it("enqueues a reminder job when a recurring rule sets remind_after_minutes", async () => {
    const db = new FakeDatabase();
    db.seed("automation_rules", [
      recurringRule({ config: { title: "Weekly review", cadence: { type: "daily" }, remind_after_minutes: 30 } }),
    ]);
    const summary = await run(db);
    expect(summary.recurring_created).toBe(1);
    expect(summary.reminders_created).toBe(0); // enqueued, not yet fired
    const jobs = db.rows("jobs");
    expect(jobs).toHaveLength(1);
    // status defaults to 'pending' in the DB schema (same as the trigger's inserts).
    expect(jobs[0]).toMatchObject({
      workspace_id: WS,
      kind: "reminder",
      run_at: new Date(Date.now() + 30 * 60_000).toISOString(),
    });
    const taskId = db.rows("tasks")[0].id;
    expect(jobs[0].payload).toEqual({ rule_id: "rule-1", task_id: taskId, title: "Weekly review" });
  });

  it("does not enqueue a reminder job without remind_after_minutes", async () => {
    const db = new FakeDatabase();
    db.seed("automation_rules", [recurringRule()]);
    await run(db);
    expect(db.rows("tasks")).toHaveLength(1); // task still created
    expect(db.rows("jobs")).toHaveLength(0);
  });

  it("materializes due reminder jobs into the reminders feed", async () => {
    const db = new FakeDatabase();
    db.seed("tasks", [{ id: "task-1", workspace_id: WS, title: "Weekly review" }]);
    db.seed("jobs", [reminderJob()]);
    const summary = await run(db);
    expect(summary.reminders_created).toBe(1);
    const rows = db.rows("reminders");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      workspace_id: WS,
      job_id: "job-1",
      rule_id: "rule-1",
      task_id: "task-1",
      title: "Weekly review",
    });
    expect(db.rows("jobs")[0].status).toBe("done");
  });

  it("skips reminder jobs that are not due yet", async () => {
    const db = new FakeDatabase();
    db.seed("tasks", [{ id: "task-1", workspace_id: WS, title: "Weekly review" }]);
    db.seed("jobs", [reminderJob({ run_at: new Date(Date.now() + 60_000).toISOString() })]);
    const summary = await run(db);
    expect(summary.reminders_created).toBe(0);
    expect(db.rows("reminders")).toHaveLength(0);
    expect(db.rows("jobs")[0].status).toBe("pending"); // still waiting to fire
  });

  it("drops reminder jobs whose task has been deleted", async () => {
    const db = new FakeDatabase();
    // No tasks seeded — the referenced task is gone.
    db.seed("jobs", [reminderJob()]);
    const summary = await run(db);
    expect(summary.reminders_created).toBe(0);
    expect(db.rows("reminders")).toHaveLength(0);
    expect(db.rows("jobs")[0].status).toBe("done");
  });

  it("drops reminder jobs whose task has been soft-deleted", async () => {
    const db = new FakeDatabase();
    db.seed("tasks", [
      { id: "task-1", workspace_id: WS, title: "Weekly review", deleted_at: new Date().toISOString() },
    ]);
    db.seed("jobs", [reminderJob()]);
    const summary = await run(db);
    expect(summary.reminders_created).toBe(0);
    expect(db.rows("reminders")).toHaveLength(0);
    expect(db.rows("jobs")[0].status).toBe("done");
  });

  it("does not duplicate reminders on a repeated drain", async () => {
    const db = new FakeDatabase();
    db.seed("tasks", [{ id: "task-1", workspace_id: WS, title: "Weekly review" }]);
    db.seed("jobs", [reminderJob()]);
    await run(db);
    await run(db); // second drain: job already done — nothing to re-materialize
    expect(db.rows("reminders")).toHaveLength(1);
  });

  // --- weekly digest ------------------------------------------------------

  it("sends a due digest and re-enqueues the next one a week out", async () => {
    const db = new FakeDatabase();
    db.seed("workspaces", [{ id: WS, owner_id: "u-1", email: "owner@test.dev", weekly_digest: true }]);
    db.seed("tasks", [
      { id: "task-1", workspace_id: WS, title: "Ship onboarding", completed_at: new Date().toISOString() },
      { id: "task-2", workspace_id: WS, title: "Fix nav bug", completed_at: null },
    ]);
    db.seed("notes", [{ id: "note-1", workspace_id: WS, title: "Deploy notes", created_at: new Date().toISOString() }]);
    db.seed("jobs", [
      { id: "digest-1", workspace_id: WS, kind: "digest", status: "pending", attempts: 0, max_attempts: 3, payload: {}, run_at: new Date(Date.now() - 60_000).toISOString() },
    ]);
    const summary = await run(db);
    expect(summary.digests_sent).toBe(1);
    // The processed job is done…
    expect(db.rows("jobs").find((j) => j.id === "digest-1")?.status).toBe("done");
    // …and a next digest was scheduled a week out (self-perpetuating chain).
    const next = db.rows("jobs").find((j) => j.id !== "digest-1");
    expect(next).toMatchObject({
      kind: "digest",
      run_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    });
  });

  it("completes a digest quietly when the workspace has no email", async () => {
    const db = new FakeDatabase();
    db.seed("workspaces", [{ id: WS, owner_id: "u-1", email: null, weekly_digest: true }]);
    db.seed("jobs", [
      { id: "digest-1", workspace_id: WS, kind: "digest", status: "pending", attempts: 0, max_attempts: 3, payload: {}, run_at: new Date(Date.now() - 60_000).toISOString() },
    ]);
    const summary = await run(db);
    expect(summary.digests_sent).toBe(0);
    expect(db.rows("jobs")).toHaveLength(1); // no re-enqueue without an email
    expect(db.rows("jobs")[0].status).toBe("done");
  });

  it("self-heals a missing digest chain when the toggle + email are set", async () => {
    const db = new FakeDatabase();
    db.seed("workspaces", [{ id: WS, owner_id: "u-1", email: "owner@test.dev", weekly_digest: true }]);
    const summary = await run(db);
    expect(summary.digests_sent).toBe(0);
    const jobs = db.rows("jobs");
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ kind: "digest", run_at: new Date().toISOString() });
  });
});
