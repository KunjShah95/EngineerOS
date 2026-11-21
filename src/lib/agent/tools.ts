/**
 * Bounded agent tool layer (plan A2 / improvements C).
 *
 * Every tool has a typed input schema (zod), server-side validation,
 * an authorization level (read vs write), and an auditable result. Read-only
 * tools run without write permission; write tools require explicit authorization.
 * Failed actions are never reported as successful.
 *
 * Improvements over the baseline:
 *  - explicit tool set: search_knowledge, get_project_context, list_blocked_tasks,
 *    create_task, update_task_status (legacy tools retained for compatibility)
 *  - idempotency for writes (duplicate requests replay the cached result)
 *  - confirmation gate for consequential changes
 *  - per-call timeout enforcement
 *  - verification of handler results (no false success claims)
 */

import { z } from "zod";

export type Permission = "read" | "write";

export interface ToolContext {
  userId: string;
  workspaceId: string;
  /** Whether the caller may perform write actions. */
  canWrite: boolean;
  /** Optional audit sink; defaults to in-memory store. */
  audit?: (entry: AuditEntry) => void;
  /** Optional per-call timeout in ms. Defaults to 5000. */
  timeoutMs?: number;
}

export interface AuditEntry {
  id: string;
  tool: string;
  userId: string;
  workspaceId: string;
  input: unknown;
  ok: boolean;
  result?: unknown;
  error?: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  duplicate?: boolean;
  timedOut?: boolean;
}

export interface ToolResult {
  ok: boolean;
  result?: unknown;
  error?: string;
  auditId: string;
  duplicate?: boolean;
  timedOut?: boolean;
  verified?: boolean;
}

export interface ToolDefinition<I = unknown, O = unknown> {
  name: string;
  description: string;
  permission: Permission;
  inputSchema: z.ZodType<I>;
  handler: (input: I, ctx: ToolContext) => Promise<O> | O;
  /** Whether this tool performs a consequential (write) change requiring confirmation. */
  requiresConfirmation?: boolean;
}

// The registry stores tools with different input/output types; a single erased alias is the honest type here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyToolDefinition = ToolDefinition<any, any>;

const tools = new Map<string, AnyToolDefinition>();
const auditLog: AuditEntry[] = [];

// Idempotency cache: key -> cached ToolResult (successful writes only).
const idempotencyCache = new Map<string, ToolResult>();

export function registerTool(def: AnyToolDefinition): void {
  if (tools.has(def.name)) throw new Error(`tool already registered: ${def.name}`);
  tools.set(def.name, def);
}

export function getTool(name: string): AnyToolDefinition | undefined {
  return tools.get(name);
}

export function listTools(): AnyToolDefinition[] {
  return [...tools.values()];
}

export function clearTools(): void {
  tools.clear();
  idempotencyCache.clear();
}

export function getAuditLog(): AuditEntry[] {
  return [...auditLog];
}

export function clearAuditLog(): void {
  auditLog.length = 0;
}

export function clearIdempotencyCache(): void {
  idempotencyCache.clear();
}

export class ToolError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

export function validateToolInput(name: string, raw: unknown): unknown {
  const def = tools.get(name);
  if (!def) throw new ToolError(`unknown tool: ${name}`, "unknown_tool");
  const parsed = def.inputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ToolError(
      `invalid input for ${name}: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
      "invalid_input"
    );
  }
  return parsed.data;
}

export function authorizeTool(name: string, ctx: ToolContext): void {
  const def = tools.get(name);
  if (!def) throw new ToolError(`unknown tool: ${name}`, "unknown_tool");
  if (def.permission === "write" && !ctx.canWrite) {
    throw new ToolError(`write permission required for ${name}`, "forbidden");
  }
}

function idempotencyKeyFor(name: string, input: unknown, ctx: ToolContext, raw: unknown): string | null {
  const r = raw as Record<string, unknown> | null;
  const explicit = r && typeof r === "object" ? r.idempotencyKey : undefined;
  const key = typeof explicit === "string" && explicit.length > 0 ? explicit : null;
  if (!key) {
    // Implicit idempotency for writes: hash of canonical input.
    if (name === "create_task" || name === "update_task_status" || name === "create_task_legacy") {
      return `${ctx.userId}:${ctx.workspaceId}:${name}:${JSON.stringify(input)}`;
    }
    return null;
  }
  return `${ctx.userId}:${ctx.workspaceId}:${name}:${key}`;
}

function verifyResult(result: unknown): boolean {
  if (result === null || result === undefined) return true;
  if (typeof result !== "object") return true;
  const r = result as Record<string, unknown>;
  if (r.ok === false) return false;
  if (r.success === false) return false;
  if (r.verified === false) return false;
  if (typeof r.error === "string" && r.error.length > 0 && r.ok !== true && r.success !== true) return false;
  return true;
}

function timeoutMs(ctx: ToolContext): number {
  return typeof ctx.timeoutMs === "number" && ctx.timeoutMs > 0 ? ctx.timeoutMs : 5000;
}

export async function executeTool(
  name: string,
  rawInput: unknown,
  ctx: ToolContext
): Promise<ToolResult> {
  const startedAt = Date.now();
  const auditId = `audit_${startedAt}_${Math.random().toString(36).slice(2, 8)}`;
  const sink = ctx.audit ?? ((e: AuditEntry) => auditLog.push(e));

  // Validation + authorization happen before idempotency replay so malformed/
  // unauthorized requests are still rejected and audited.
  let parsedInput: unknown;
  try {
    parsedInput = validateToolInput(name, rawInput);
    authorizeTool(name, ctx);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const entry: AuditEntry = {
      id: auditId,
      tool: name,
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      input: rawInput,
      ok: false,
      error,
      startedAt,
      endedAt: Date.now(),
      durationMs: Date.now() - startedAt,
    };
    sink(entry);
    return { ok: false, error, auditId };
  }

  const def = tools.get(name)!;

  // Confirmation gate for consequential changes.
  if (def.requiresConfirmation) {
    const r = rawInput as Record<string, unknown> | null;
    if (r && typeof r === "object" && r.confirm === false) {
      const error = `confirmation required for ${name}`;
      const entry: AuditEntry = {
        id: auditId,
        tool: name,
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
        input: parsedInput,
        ok: false,
        error,
        startedAt,
        endedAt: Date.now(),
        durationMs: Date.now() - startedAt,
      };
      sink(entry);
      return { ok: false, error, auditId };
    }
  }

  // Idempotency replay.
  const ikey = idempotencyKeyFor(name, parsedInput, ctx, rawInput);
  if (ikey && idempotencyCache.has(ikey)) {
    const cached = { ...idempotencyCache.get(ikey)! };
    cached.auditId = auditId;
    cached.duplicate = true;
    const entry: AuditEntry = {
      id: auditId,
      tool: name,
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      input: parsedInput,
      ok: cached.ok,
      result: cached.result,
      startedAt,
      endedAt: Date.now(),
      durationMs: Date.now() - startedAt,
      duplicate: true,
    };
    sink(entry);
    return cached;
  }

  const tms = timeoutMs(ctx);
  let timedOut = false;
  let result: unknown;
  let error: string | undefined;
  let ok = false;

  try {
    const handlerPromise = Promise.resolve(def.handler(parsedInput, ctx));
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("tool_timeout")), tms);
    });
    result = await Promise.race([handlerPromise, timeoutPromise]);
    if (!verifyResult(result)) {
      throw new Error("verification failed: tool reported success without evidence");
    }
    ok = true;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    if (error === "tool_timeout") timedOut = true;
    ok = false;
  }

  const entry: AuditEntry = {
    id: auditId,
    tool: name,
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
    input: parsedInput,
    ok,
    result: ok ? result : undefined,
    error: ok ? undefined : error,
    startedAt,
    endedAt: Date.now(),
    durationMs: Date.now() - startedAt,
    timedOut,
  };
  sink(entry);

  const out: ToolResult = ok
    ? { ok: true, result, auditId, verified: true }
    : { ok: false, error, auditId, timedOut };

  if (ok && ikey) {
    idempotencyCache.set(ikey, { ...out });
  }

  return out;
}

/* ---------- schemas ---------- */

// New explicit tool set (improvement C)
export const searchKnowledgeSchema = z.object({
  query: z.string().min(1).max(500),
  k: z.number().int().min(1).max(50).default(8),
});

export const getProjectContextSchema = z.object({
  projectId: z.string().min(1),
});

export const listBlockedTasksSchema = z.object({
  projectId: z.string().optional(),
});

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  projectId: z.string().optional(),
  confirm: z.boolean().optional(),
  idempotencyKey: z.string().optional(),
});

export const updateTaskStatusSchema = z.object({
  taskId: z.string().min(1),
  status: z.enum(["backlog", "todo", "in_progress", "done"]),
  confirm: z.boolean().optional(),
  idempotencyKey: z.string().optional(),
});

// Legacy schemas (retained for compatibility)
export const searchNotesSchema = z.object({
  query: z.string().min(1).max(500),
  k: z.number().int().min(1).max(50).default(5),
});

export const inspectTaskSchema = z.object({
  taskId: z.string().min(1),
});

export const updateNoteSchema = z.object({
  noteId: z.string().min(1),
  patch: z.object({
    title: z.string().min(1).max(200).optional(),
    content: z.string().optional(),
  }),
  confirm: z.boolean().optional(),
  idempotencyKey: z.string().optional(),
});

export function registerBuiltinTools(handlers: {
  // New
  searchKnowledge?: (input: z.infer<typeof searchKnowledgeSchema>, ctx: ToolContext) => unknown;
  getProjectContext?: (input: z.infer<typeof getProjectContextSchema>, ctx: ToolContext) => unknown;
  listBlockedTasks?: (input: z.infer<typeof listBlockedTasksSchema>, ctx: ToolContext) => unknown;
  createTask?: (input: z.infer<typeof createTaskSchema>, ctx: ToolContext) => unknown;
  updateTaskStatus?: (input: z.infer<typeof updateTaskStatusSchema>, ctx: ToolContext) => unknown;
  // Legacy
  searchNotes?: (input: z.infer<typeof searchNotesSchema>, ctx: ToolContext) => unknown;
  inspectTask?: (input: z.infer<typeof inspectTaskSchema>, ctx: ToolContext) => unknown;
  updateNote?: (input: z.infer<typeof updateNoteSchema>, ctx: ToolContext) => unknown;
}): void {
  if (handlers.searchKnowledge) {
    registerTool({
      name: "search_knowledge",
      description: "Search the workspace knowledge base by meaning and keyword.",
      permission: "read",
      inputSchema: searchKnowledgeSchema,
      handler: (input, ctx) => handlers.searchKnowledge!(input, ctx),
    });
  }
  if (handlers.getProjectContext) {
    registerTool({
      name: "get_project_context",
      description: "Get structured context for a project: notes, tasks, status.",
      permission: "read",
      inputSchema: getProjectContextSchema,
      handler: (input, ctx) => handlers.getProjectContext!(input, ctx),
    });
  }
  if (handlers.listBlockedTasks) {
    registerTool({
      name: "list_blocked_tasks",
      description: "List tasks that are blocked by another task.",
      permission: "read",
      inputSchema: listBlockedTasksSchema,
      handler: (input, ctx) => handlers.listBlockedTasks!(input, ctx),
    });
  }
  if (handlers.createTask) {
    registerTool({
      name: "create_task",
      description: "Create a task in the current workspace.",
      permission: "write",
      requiresConfirmation: true,
      inputSchema: createTaskSchema,
      handler: (input, ctx) => handlers.createTask!(input, ctx),
    });
  }
  if (handlers.updateTaskStatus) {
    registerTool({
      name: "update_task_status",
      description: "Update a task's status.",
      permission: "write",
      requiresConfirmation: true,
      inputSchema: updateTaskStatusSchema,
      handler: (input, ctx) => handlers.updateTaskStatus!(input, ctx),
    });
  }
  // Legacy
  if (handlers.searchNotes) {
    registerTool({
      name: "search_notes",
      description: "Search notes in the current workspace by meaning/keyword.",
      permission: "read",
      inputSchema: searchNotesSchema,
      handler: (input, ctx) => handlers.searchNotes!(input, ctx),
    });
  }
  if (handlers.inspectTask) {
    registerTool({
      name: "inspect_task",
      description: "Inspect a task and its linked notes.",
      permission: "read",
      inputSchema: inspectTaskSchema,
      handler: (input, ctx) => handlers.inspectTask!(input, ctx),
    });
  }
  if (handlers.updateNote) {
    registerTool({
      name: "update_note",
      description: "Update a note's title or content.",
      permission: "write",
      requiresConfirmation: true,
      inputSchema: updateNoteSchema,
      handler: (input, ctx) => handlers.updateNote!(input, ctx),
    });
  }
}

/* ---------- task benchmark ---------- */

export interface TaskBenchmarkCase {
  name: string;
  run: () => Promise<{ ok: boolean; detail?: string }>;
}

export interface TaskBenchmarkResult {
  total: number;
  passed: number;
  failed: number;
  completionRate: number;
  failures: { name: string; detail?: string }[];
}

export async function runTaskBenchmark(cases: TaskBenchmarkCase[]): Promise<TaskBenchmarkResult> {
  const failures: { name: string; detail?: string }[] = [];
  let passed = 0;
  for (const c of cases) {
    try {
      const r = await c.run();
      if (r.ok) passed += 1;
      else failures.push({ name: c.name, detail: r.detail });
    } catch (err) {
      failures.push({ name: c.name, detail: err instanceof Error ? err.message : String(err) });
    }
  }
  return {
    total: cases.length,
    passed,
    failed: cases.length - passed,
    completionRate: cases.length ? passed / cases.length : 0,
    failures,
  };
}