import { describe, expect, it } from "vitest";

import { parseDecisionReply } from "@/lib/ai/decisions";

const full = {
  has_decision: true,
  title: "Use at-least-once delivery for the job queue",
  decision: "Switch the queue to at-least-once and make handlers idempotent.",
  context: "The broker cannot guarantee exactly-once.",
  alternatives: [
    { option: "Exactly-once via outbox", rejected_because: "Too much infra for v1" },
    { option: "", rejected_because: "dropped: empty option" },
  ],
  consequences: "Handlers must dedupe by job id.",
  revisit_when: "If duplicate side effects show up in billing.",
};

describe("parseDecisionReply", () => {
  it("parses a clean JSON reply and drops empty alternatives", () => {
    const draft = parseDecisionReply(JSON.stringify(full));
    expect(draft).toEqual({
      title: full.title,
      decision: full.decision,
      context: full.context,
      alternatives: [full.alternatives[0]],
      consequences: full.consequences,
      revisit_when: full.revisit_when,
    });
  });

  it("tolerates code fences and surrounding chatter", () => {
    const reply = "Sure! Here it is:\n```json\n" + JSON.stringify(full) + "\n```\nHope that helps.";
    expect(parseDecisionReply(reply)?.title).toBe(full.title);
  });

  it("returns null when there is no decision or the reply is unusable", () => {
    expect(parseDecisionReply('{"has_decision": false}')).toBeNull();
    expect(parseDecisionReply("no json here")).toBeNull();
    expect(parseDecisionReply("{not valid json}")).toBeNull();
    // has_decision must be literally true, not truthy
    expect(parseDecisionReply(JSON.stringify({ ...full, has_decision: "yes" }))).toBeNull();
    // title and decision are required
    expect(parseDecisionReply(JSON.stringify({ ...full, decision: "  " }))).toBeNull();
  });

  it("coerces bad field types and caps lengths", () => {
    const draft = parseDecisionReply(
      JSON.stringify({ ...full, context: 42, alternatives: "nope", title: "x".repeat(500) }),
    );
    expect(draft?.context).toBe("");
    expect(draft?.alternatives).toEqual([]);
    expect(draft?.title).toHaveLength(200);
  });
});
