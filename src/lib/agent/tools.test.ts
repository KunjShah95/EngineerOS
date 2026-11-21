import { describe, expect, it, beforeEach } from "vitest";
import {
  authorizeTool,
  clearAuditLog,
  clearTools,
  executeTool,
  getAuditLog,
  registerBuiltinTools,
  runTaskBenchmark,
  validateToolInput,
} from "./tools";

describe("agent tools", () => {
  beforeEach(() => {
    clearTools();
    clearAuditLog();
    registerBuiltinTools({
      searchNotes: (input) => ({ hits: [input.query] }),
      inspectTask: (input) => ({ id: input.taskId }),
      createTask: (input) => ({ id: "t1", title: input.title }),
      updateNote: (input) => ({ id: input.noteId, patched: true }),
    });
  });

  it("validates input schema server-side", () => {
    expect(() => validateToolInput("create_task", { title: "" })).toThrow();
    expect(() => validateToolInput("create_task", { title: "ok" })).not.toThrow();
    expect(() => validateToolInput("nope", {})).toThrow();
  });

  it("read tools work without write permission", async () => {
    const ctx = { userId: "u", workspaceId: "w", canWrite: false };
    const r = await executeTool("search_notes", { query: "auth" }, ctx);
    expect(r.ok).toBe(true);
  });

  it("write tools require authorization", async () => {
    const ctx = { userId: "u", workspaceId: "w", canWrite: false };
    const r = await executeTool("create_task", { title: "x" }, ctx);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("write permission");
  });

  it("write tools succeed with permission and audit", async () => {
    const ctx = { userId: "u", workspaceId: "w", canWrite: true };
    const r = await executeTool("create_task", { title: "x" }, ctx);
    expect(r.ok).toBe(true);
    const log = getAuditLog();
    expect(log.length).toBe(1);
    expect(log[0].ok).toBe(true);
    expect(log[0].tool).toBe("create_task");
  });

  it("failed actions never appear successful", async () => {
    const ctx = { userId: "u", workspaceId: "w", canWrite: true };
    const r = await executeTool("update_note", { noteId: "n1", patch: { title: "" } }, ctx);
    expect(r.ok).toBe(false);
    const log = getAuditLog();
    expect(log[log.length - 1].ok).toBe(false);
  });

  it("invalid input is audited as failure", async () => {
    const ctx = { userId: "u", workspaceId: "w", canWrite: true };
    const r = await executeTool("create_task", { title: "" }, ctx);
    expect(r.ok).toBe(false);
    expect(getAuditLog().slice(-1)[0].ok).toBe(false);
  });

  it("benchmark reports completion rate", async () => {
    const res = await runTaskBenchmark([
      { name: "a", run: async () => ({ ok: true }) },
      { name: "b", run: async () => ({ ok: false, detail: "nope" }) },
    ]);
    expect(res.completionRate).toBe(0.5);
    expect(res.failures.length).toBe(1);
  });
});