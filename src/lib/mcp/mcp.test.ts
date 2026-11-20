import { describe, expect, it } from "vitest";

import { createLimiter } from "./rate-limit";
import { handleMessage, negotiateVersion, type JsonRpcResponse } from "./server";

const call = (method: string, params?: unknown, id: number | undefined = 1) =>
  handleMessage({ jsonrpc: "2.0", id, method, params }) as JsonRpcResponse;

const toolText = (res: JsonRpcResponse) =>
  ((res.result as { content: { text: string }[] }).content[0].text);

describe("mcp protocol", () => {
  it("negotiates protocol versions", () => {
    expect(negotiateVersion("2025-03-26")).toBe("2025-03-26");
    expect(negotiateVersion("1999-01-01")).toBe("2025-06-18");
    expect(negotiateVersion(undefined)).toBe("2025-06-18");
  });

  it("initializes and advertises tools", () => {
    const res = call("initialize", { protocolVersion: "2025-06-18" });
    const r = res.result as { capabilities: { tools: unknown }; serverInfo: { name: string } };
    expect(r.capabilities.tools).toBeDefined();
    expect(r.serverInfo.name).toBe("engineeros-learn");
  });

  it("does not answer notifications", () => {
    expect(handleMessage({ jsonrpc: "2.0", method: "notifications/initialized" })).toBeNull();
  });

  it("lists read-only tools with schemas", () => {
    const tools = (call("tools/list").result as { tools: { name: string; annotations: { readOnlyHint: boolean }; inputSchema: { type: string } }[] }).tools;
    expect(tools.map((t) => t.name)).toEqual(
      expect.arrayContaining(["list_tracks", "get_topic", "search_topics", "learning_path", "next_topics", "get_map"])
    );
    for (const t of tools) {
      expect(t.annotations.readOnlyHint).toBe(true);
      expect(t.inputSchema.type).toBe("object");
    }
  });

  it("rejects non-JSON-RPC input and unknown methods", () => {
    expect(handleMessage({ hello: "world" })?.error?.code).toBe(-32600);
    expect(call("does/not/exist").error?.code).toBe(-32601);
  });
});

describe("mcp tools", () => {
  it("searches", () => {
    const res = call("tools/call", { name: "search_topics", arguments: { query: "idempotency key" } });
    const hits = JSON.parse(toolText(res));
    expect(hits[0].id).toBe("idempotency-and-retries");
    expect(hits[0].url).toContain("/learn/system-design/idempotency-and-retries");
  });

  it("returns a full topic with prerequisites", () => {
    const res = call("tools/call", { name: "get_topic", arguments: { id: "agent-loop" } });
    const topic = JSON.parse(toolText(res));
    expect(topic.prerequisites.map((p: { id: string }) => p.id)).toContain("tool-use-and-function-calling");
    expect(topic.keyPoints.length).toBeGreaterThan(0);
  });

  it("reports unknown ids as tool errors, not protocol errors", () => {
    const res = call("tools/call", { name: "get_topic", arguments: { id: "nope" } });
    expect(res.error).toBeUndefined();
    expect((res.result as { isError: boolean }).isError).toBe(true);
  });

  it("reports invalid arguments as tool errors", () => {
    const res = call("tools/call", { name: "search_topics", arguments: { query: "x", limit: 500 } });
    expect((res.result as { isError: boolean }).isError).toBe(true);
    expect(toolText(res)).toMatch(/Invalid arguments/);
  });

  it("plans a path and next steps", () => {
    const path = JSON.parse(toolText(call("tools/call", { name: "learning_path", arguments: { target: "harness-engineering" } })));
    expect(path.steps.at(-1).id).toBe("harness-engineering");
    expect(path.totalMinutes).toBeGreaterThan(0);
    const next = JSON.parse(toolText(call("tools/call", { name: "next_topics", arguments: { completed: ["llm-fundamentals", "bogus"] } })));
    expect(next.unknownIds).toEqual(["bogus"]);
    expect(next.ready.map((t: { id: string }) => t.id)).toContain("prompting-and-structured-output");
  });

  it("fails unknown tools as invalid params", () => {
    expect(call("tools/call", { name: "nope" }).error?.code).toBe(-32602);
  });
});

describe("rate limiter", () => {
  it("allows bursts then throttles and refills", () => {
    let t = 0;
    const l = createLimiter({ capacity: 3, refillPerSecond: 1, now: () => t });
    expect([1, 2, 3].map(() => l.take("a").allowed)).toEqual([true, true, true]);
    const blocked = l.take("a");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(1);
    t += 2000;
    expect(l.take("a").allowed).toBe(true);
    expect(l.take("b").allowed).toBe(true); // separate key
  });

  it("bounds memory", () => {
    const l = createLimiter({ capacity: 1, refillPerSecond: 1, maxKeys: 2 });
    for (const k of ["a", "b", "c"]) l.take(k);
    expect(l.take("a").allowed).toBe(true); // "a" was evicted, so it starts fresh
  });
});
