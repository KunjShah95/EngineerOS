import { describe, expect, it } from "vitest";

import { buildConflictPrompt, parseConflictReply } from "@/lib/ai/decision-conflicts";

const ids = ["old-1", "old-2", "old-3"];

describe("parseConflictReply", () => {
  it("maps 1-based indexes to ids and keeps only real conflicts", () => {
    const reply = JSON.stringify({
      results: [
        { index: 1, relation: "supersedes", reason: "Adds Redis after deciding against it." },
        { index: 2, relation: "none", reason: "Unrelated." },
        { index: 3, relation: "conflicts", reason: "  Both can't hold.  " },
      ],
    });
    expect(parseConflictReply(reply, ids)).toEqual([
      { earlierId: "old-1", relation: "supersedes", reason: "Adds Redis after deciding against it." },
      { earlierId: "old-3", relation: "conflicts", reason: "Both can't hold." },
    ]);
  });

  it("drops out-of-range, non-integer, duplicate and unknown-relation entries", () => {
    const reply = JSON.stringify({
      results: [
        { index: 0, relation: "supersedes" },
        { index: 4, relation: "supersedes" },
        { index: 1.5, relation: "conflicts" },
        { index: "2", relation: "conflicts", reason: "string index is fine" },
        { index: 2, relation: "supersedes", reason: "duplicate" },
        { index: 3, relation: "maybe" },
      ],
    });
    expect(parseConflictReply(reply, ids)).toEqual([
      { earlierId: "old-2", relation: "conflicts", reason: "string index is fine" },
    ]);
  });

  it("tolerates fences and returns nothing for unusable replies", () => {
    const fenced = "```json\n" + JSON.stringify({ results: [{ index: 1, relation: "conflicts", reason: "x" }] }) + "\n```";
    expect(parseConflictReply(fenced, ids)).toHaveLength(1);
    expect(parseConflictReply("no idea", ids)).toEqual([]);
    expect(parseConflictReply("{broken", ids)).toEqual([]);
    expect(parseConflictReply('{"results": "nope"}', ids)).toEqual([]);
  });
});

describe("buildConflictPrompt", () => {
  it("numbers earlier decisions from 1 and omits empty context", () => {
    const prompt = buildConflictPrompt(
      { title: "Add Redis cache", decision: "Cache sessions in Redis.", context: "" },
      [{ title: "No Redis", decision: "Postgres is enough.", context: "Small team." }],
    );
    expect(prompt).toBe(
      "NEW decision:\nTitle: Add Redis cache\nDecision: Cache sessions in Redis.\n\n" +
        "EARLIER decision 1:\nTitle: No Redis\nDecision: Postgres is enough.\nContext: Small team.",
    );
  });
});
