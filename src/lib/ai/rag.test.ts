import { describe, expect, it } from "vitest";
import { answerWithContext, type RagChunk } from "./rag";
import type { EmbeddingEntity } from "@/types/database";

describe("answerWithContext unsupported questions", () => {
  it("refuses with searched terms when no chunks", async () => {
    const res = await answerWithContext("zzzz nonexistent topic", [], []);
    expect(res.sources).toEqual([]);
    expect(res.answer).toContain("couldn't find");
    expect(res.answer).toContain("zzzz");
  });

  it("uses local fallback when provided", async () => {
    const chunks = [
      { content: "auth uses supabase", source: { entity_type: "note" as EmbeddingEntity, entity_id: "n1", title: "Auth", href: "/notes/n1", score: 0.9 } },
    ];
    const res = await answerWithContext("anything", chunks as unknown as RagChunk[], [], "fallback answer");
    expect(res.model).toBe("local-structured");
    expect(res.answer).toBe("fallback answer");
  });

  it("refuses with empty sources when no context and no fallback", async () => {
    const res = await answerWithContext("zzzz", [], []);
    expect(res.sources).toEqual([]);
    expect(res.answer).toContain("couldn't find");
  });
});