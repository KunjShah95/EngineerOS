import { describe, expect, it } from "vitest";

import { chatCaptureNote, rankByTermHits, topicTerms } from "@/lib/decision-context";

describe("topicTerms", () => {
  it("keeps distinct, filter-safe topic words and drops stopwords", () => {
    expect(topicTerms("Add retry logic to the payment queue, with the queue's backoff")).toEqual([
      "retry",
      "logic",
      "payment",
      "queue",
      "backoff",
    ]);
  });

  it("never emits PostgREST filter syntax characters", () => {
    for (const t of topicTerms("x.or(id.eq.1),title.ilike.%evil% (drop) redis,cache")) {
      expect(t).toMatch(/^[a-z0-9]+$/);
    }
  });

  it("caps the number of terms", () => {
    expect(topicTerms("alpha bravo charlie delta echoes foxtrot golfing hotel", 3)).toHaveLength(3);
  });
});

describe("rankByTermHits", () => {
  const d = (id: string, title: string, decision = "", context = "") => ({ id, title, decision, context });
  const candidates = [
    d("a", "Use Redis for the job queue", "Queue backed by Redis streams"),
    d("b", "Adopt Postgres advisory locks", "", "Retry storms on the payment queue"),
    d("c", "Move CSS to Tailwind"),
  ];

  it("ranks by distinct term hits and requires two hits when there are several terms", () => {
    expect(rankByTermHits(candidates, ["payment", "queue", "retry"]).map((c) => c.id)).toEqual(["b"]);
    expect(rankByTermHits(candidates, ["redis", "queue"]).map((c) => c.id)).toEqual(["a"]);
  });

  it("accepts a single hit when only one term exists", () => {
    expect(rankByTermHits(candidates, ["tailwind"]).map((c) => c.id)).toEqual(["c"]);
    expect(rankByTermHits(candidates, [])).toEqual([]);
  });
});

describe("chatCaptureNote", () => {
  const now = new Date("2026-09-28T09:00:00Z");

  it("records provenance and keeps the transcript verbatim", () => {
    const note = chatCaptureNote("  user: should we shard?\nassistant: not yet  ", "ChatGPT", now);
    expect(note.title).toBe("Chat capture from ChatGPT — 2026-09-28");
    expect(note.body_markdown).toBe(
      "> Captured from a pasted conversation from ChatGPT on 2026-09-28.\n\n## Conversation\n\nuser: should we shard?\nassistant: not yet",
    );
  });

  it("omits the source when blank", () => {
    expect(chatCaptureNote("hello there", " ", now).title).toBe("Chat capture — 2026-09-28");
  });
});
