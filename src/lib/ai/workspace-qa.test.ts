// Unit tests for the structured workspace Q&A layer (src/lib/ai/workspace-qa.ts).
// Covers the pure intent/date detection and summary renderers; the DB-backed
// query handlers need a live Supabase so they are exercised via the route.

import { describe, expect, it } from "vitest";

import {
  detectIntent,
  parseTimeWindow,
  renderDue,
  renderFollowUp,
  renderOpenTasks,
  renderOverview,
  renderProjects,
  renderRecentActivity,
} from "@/lib/ai/workspace-qa";

// Fixed "now": 2026-08-04 12:00 local (a Tuesday).
const NOW = new Date(2026, 7, 4, 12, 0, 0);

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

describe("parseTimeWindow", () => {
  it("resolves 'last week' to the previous calendar week (Mon-Sun)", () => {
    const w = parseTimeWindow("What did I do last week?", NOW)!;
    expect(ymd(w.start)).toBe("2026-07-27");
    expect(ymd(w.end)).toBe("2026-08-02");
    expect(w.label).toBe("last week");
  });

  it("resolves 'yesterday'", () => {
    const w = parseTimeWindow("Summarize yesterday", NOW)!;
    expect(ymd(w.start)).toBe("2026-08-03");
    expect(ymd(w.end)).toBe("2026-08-03");
  });

  it("resolves 'last 7 days' as a rolling window ending now", () => {
    const w = parseTimeWindow("last 7 days", NOW)!;
    expect(ymd(w.start)).toBe("2026-07-29");
    expect(w.end.getTime()).toBe(NOW.getTime());
    expect(w.label).toBe("last 7 days");
  });

  it("resolves 'this week' from Monday", () => {
    const w = parseTimeWindow("this week", NOW)!;
    expect(ymd(w.start)).toBe("2026-08-03");
  });

  it("resolves 'this month' and 'last month'", () => {
    expect(ymd(parseTimeWindow("this month", NOW)!.start)).toBe("2026-08-01");
    const lm = parseTimeWindow("last month", NOW)!;
    expect(ymd(lm.start)).toBe("2026-07-01");
    expect(ymd(lm.end)).toBe("2026-07-31");
  });

  it("returns null for questions without a time expression", () => {
    expect(parseTimeWindow("Summarize my open tasks", NOW)).toBeNull();
  });
});

describe("detectIntent", () => {
  it("routes 'Summarize my open tasks' to open_tasks", () => {
    expect(detectIntent("Summarize my open tasks", NOW)?.intent).toBe("open_tasks");
  });

  it("routes 'What did I do last week?' to recent_activity with a window", () => {
    const d = detectIntent("What did I do last week?", NOW)!;
    expect(d.intent).toBe("recent_activity");
    expect(d.window?.label).toBe("last week");
  });

  it("routes 'Any meetings or decisions I should follow up on?' to follow_up", () => {
    expect(detectIntent("Any meetings or decisions I should follow up on?", NOW)?.intent).toBe("follow_up");
  });

  it("routes 'How many notes do I have?' to workspace_overview", () => {
    expect(detectIntent("How many notes do I have?", NOW)?.intent).toBe("workspace_overview");
  });

  it("routes 'Summarize my completed tasks' to completed_tasks", () => {
    expect(detectIntent("Summarize my completed tasks", NOW)?.intent).toBe("completed_tasks");
  });

  it("routes 'What tasks are overdue?' to due_tasks", () => {
    expect(detectIntent("What tasks are overdue?", NOW)?.intent).toBe("due_tasks");
  });

  it("routes project status questions to project_summary", () => {
    expect(detectIntent("What is the progress on my projects?", NOW)?.intent).toBe("project_summary");
  });

  it("leaves document-retrieval questions unhandled (RAG fallback)", () => {
    expect(detectIntent("What do my notes say about the auth migration?", NOW)).toBeNull();
  });
});

describe("summary renderers", () => {
  it("renders open tasks with priorities and backlog", () => {
    const out = renderOpenTasks(
      [{ title: "Fix login bug", status: "todo", priority: "high", due_date: "2026-08-10" }],
      [{ title: "Backlog idea", status: "backlog" }]
    );
    expect(out).toContain("You have 1 open task:");
    expect(out).toContain("1. [high] Fix login bug (due 2026-08-10)");
    expect(out).toContain("Plus 1 in backlog:");
    expect(out).toContain("1. Backlog idea");
  });

  it("reports when there are no open tasks", () => {
    expect(renderOpenTasks([], [])).toContain("no open tasks");
  });

  it("renders recent activity from daily notes and completed tasks", () => {
    const out = renderRecentActivity(
      "last week",
      "2026-07-27",
      "2026-08-02",
      [{ date: "2026-07-28", wins: "Shipped auth v2", journal: "Lots of refactoring." }],
      [{ title: "Ship auth v2", status: "done", completed_at: "2026-07-30T10:00:00Z" }],
      []
    );
    expect(out).toContain("last week (2026-07-27 → 2026-08-02)");
    expect(out).toContain("2026-07-28");
    expect(out).toContain("Wins: Shipped auth v2");
    expect(out).toContain("Ship auth v2 (2026-07-30)");
  });

  it("renders projects, due tasks, overview, and follow-up", () => {
    expect(renderProjects([{ name: "EngineerOS", status: "active", open: 3, done: 5 }])).toContain("EngineerOS");
    expect(renderDue([{ title: "Old task", status: "todo", due_date: "2026-07-01" }], [], "2026-08-11")).toContain(
      "1 overdue task"
    );
    expect(renderOverview({ notes: 4, tasksTotal: 9, todo: 2, inProgress: 3, done: 4, projects: 2, resources: 5, pdfs: 1, dailies: 30 })).toContain(
      "Notes: 4"
    );
    expect(renderFollowUp([{ title: "Sync call" }], [{ date: "2026-08-03", tomorrow: "Finish migration" }], [])).toContain(
      "Sync call"
    );
  });
});

