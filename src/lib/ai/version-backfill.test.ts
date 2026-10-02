import { describe, expect, it } from "vitest";

import { planBackfill, type BackfillCandidate } from "./version-backfill";

const WS = "ws-1";
const NOW = new Date("2026-08-01T12:00:00Z");

function note(overrides: Partial<BackfillCandidate> = {}): BackfillCandidate {
  return {
    id: "n1",
    title: "Auth decision",
    body_markdown: "We use session cookies.",
    created_at: "2026-01-05T09:00:00Z",
    updated_at: "2026-01-05T09:00:00Z",
    ...overrides,
  };
}

describe("planBackfill", () => {
  it("backdates a note that was never edited, since its body is the original", () => {
    const plan = planBackfill([note()], WS, new Set(), NOW);
    expect(plan.rows[0].created_at).toBe("2026-01-05T09:00:00Z");
    expect(plan.backdated).toBe(1);
    expect(plan.fromNow).toBe(0);
  });

  it("tolerates sub-second jitter between create and first update", () => {
    const plan = planBackfill(
      [note({ created_at: "2026-01-05T09:00:00.000Z", updated_at: "2026-01-05T09:00:03.000Z" })],
      WS,
      new Set(),
      NOW
    );
    expect(plan.backdated).toBe(1);
  });

  // The honesty case: a rewritten note must not claim its June text existed in January.
  it("dates an edited note as-of-now rather than backdating it", () => {
    const plan = planBackfill(
      [note({ updated_at: "2026-06-20T09:00:00Z" })],
      WS,
      new Set(),
      NOW
    );
    expect(plan.rows[0].created_at).toBe(NOW.toISOString());
    expect(plan.fromNow).toBe(1);
    expect(plan.backdated).toBe(0);
  });

  it("skips notes that already have any history (idempotent re-runs)", () => {
    const plan = planBackfill([note()], WS, new Set(["n1"]), NOW);
    expect(plan.rows).toHaveLength(0);
    expect(plan.skipped).toBe(1);
  });

  it("skips empty bodies — there is nothing worth recording", () => {
    const plan = planBackfill([note({ body_markdown: "   \n " })], WS, new Set(), NOW);
    expect(plan.rows).toHaveLength(0);
    expect(plan.skipped).toBe(1);
  });

  it("carries workspace, title and body onto every row", () => {
    const plan = planBackfill([note({ title: "Sprint checklist" })], WS, new Set(), NOW);
    expect(plan.rows[0]).toMatchObject({
      note_id: "n1",
      workspace_id: WS,
      title: "Sprint checklist",
      body_markdown: "We use session cookies.",
    });
  });

  it("mixes tiers across a workspace and counts each", () => {
    const plan = planBackfill(
      [
        note({ id: "a" }),
        note({ id: "b", updated_at: "2026-07-01T00:00:00Z" }),
        note({ id: "c", body_markdown: "" }),
      ],
      WS,
      new Set(),
      NOW
    );
    expect(plan.backdated).toBe(1);
    expect(plan.fromNow).toBe(1);
    expect(plan.skipped).toBe(1);
    expect(plan.rows).toHaveLength(2);
  });
});
