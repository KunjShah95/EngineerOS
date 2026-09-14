import { describe, expect, it } from "vitest";

import { safeNextPath } from "./next-path";

describe("safeNextPath", () => {
  it("keeps an ordinary internal path", () => {
    expect(safeNextPath("/invite/abc123")).toBe("/invite/abc123");
    expect(safeNextPath("/notes/5")).toBe("/notes/5");
    expect(safeNextPath("/tasks?task=1")).toBe("/tasks?task=1");
  });

  it("falls back for missing, empty or non-string values", () => {
    for (const value of [null, undefined, "", 42, {}]) {
      expect(safeNextPath(value as never)).toBe("/dashboard");
    }
  });

  it("rejects a protocol-relative URL", () => {
    // The whole reason this helper exists: "//evil.example" resolves against the
    // current scheme and leaves the origin.
    expect(safeNextPath("//evil.example")).toBe("/dashboard");
    expect(safeNextPath("//evil.example/path")).toBe("/dashboard");
  });

  it("rejects the backslash trick browsers treat as a slash", () => {
    expect(safeNextPath("/\\evil.example")).toBe("/dashboard");
  });

  it("rejects an absolute URL with a scheme", () => {
    expect(safeNextPath("/https://evil.example")).toBe("/dashboard");
  });

  it("honours a custom fallback", () => {
    expect(safeNextPath(null, "/pricing")).toBe("/pricing");
  });

  it("never returns an off-origin target", () => {
    const hostile = [
      "//evil.example",
      "/\\/evil.example",
      "https://evil.example",
      "http://evil.example",
      "/javascript:alert(1):",
    ];
    for (const value of hostile) {
      const out = safeNextPath(value);
      expect(out).toBe("/dashboard");
    }
  });
});
