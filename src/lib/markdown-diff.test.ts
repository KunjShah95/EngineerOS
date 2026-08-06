import { describe, expect, it } from "vitest";

import { diffMarkdown, diffStats } from "./markdown-diff";

describe("diffMarkdown", () => {
  it("returns no changes for identical bodies", () => {
    const body = "# Title\n\nSome paragraph.\n";
    const d = diffMarkdown(body, body);
    expect(d.added).toBe(0);
    expect(d.removed).toBe(0);
    expect(d.lines.every((l) => l.kind === "same")).toBe(true);
  });

  it("flags appended lines as added", () => {
    const d = diffMarkdown("line one\n", "line one\nline two\n");
    expect(d.added).toBe(1);
    expect(d.removed).toBe(0);
    const added = d.lines.filter((l) => l.kind === "added");
    expect(added).toHaveLength(1);
    expect(added[0].text).toBe("line two");
  });

  it("flags removed lines", () => {
    const d = diffMarkdown("keep\nremove me\nkeep2\n", "keep\nkeep2\n");
    expect(d.removed).toBe(1);
    expect(d.lines.filter((l) => l.kind === "removed")[0].text).toBe("remove me");
  });

  it("word-diffs a modified line with intra-line segments", () => {
    const d = diffMarkdown("The quick brown fox\n", "The quick orange fox\n");
    const pair = d.lines.filter((l) => l.kind !== "same");
    expect(pair).toHaveLength(2);
    const removedRow = pair.find((l) => l.kind === "removed");
    const addedRow = pair.find((l) => l.kind === "added");
    expect(removedRow?.segments?.some((s) => s.kind === "removed" && s.text.includes("brown"))).toBe(true);
    expect(addedRow?.segments?.some((s) => s.kind === "added" && s.text.includes("orange"))).toBe(true);
    // shared words stay neutral
    expect(addedRow?.segments?.some((s) => s.kind === "same" && s.text.includes("quick"))).toBe(true);
  });

  it("pairs multi-line replacements", () => {
    const d = diffMarkdown("a\nb\nc\n", "a\nx\ny\nc\n");
    // b (1 line) was replaced by x\ny (2 lines).
    expect(d.removed).toBe(1);
    expect(d.added).toBe(2);
    expect(d.lines.filter((l) => l.kind === "same").map((l) => l.text)).toEqual(["a", "c"]);
    const pair = d.lines.filter((l) => l.kind !== "same");
    expect(pair).toHaveLength(3);
    // The first removed row is word-paired with the first added row.
    expect(pair[0].kind).toBe("removed");
    expect(pair[0].text).toBe("b");
    expect(pair[1].kind).toBe("added");
    expect(pair[1].text).toBe("x");
    expect(pair[2]).toMatchObject({ kind: "added", text: "y" });
  });

  it("preserves blank interior lines", () => {
    const d = diffMarkdown("a\n\nb\n", "a\n\nc\n");
    const same = d.lines.filter((l) => l.kind === "same");
    expect(same.map((l) => l.text)).toContain("");
    expect(d.lines.filter((l) => l.kind === "added").map((l) => l.text)).toEqual(["c"]);
  });

  it("treats a diff from empty as all added", () => {
    const d = diffMarkdown("", "hello\nworld\n");
    expect(d.added).toBe(2);
    expect(d.removed).toBe(0);
    expect(d.lines.every((l) => l.kind === "added")).toBe(true);
  });

  it("treats a diff to empty as all removed", () => {
    const d = diffMarkdown("hello\nworld\n", "");
    expect(d.removed).toBe(2);
    expect(d.added).toBe(0);
    expect(d.lines.every((l) => l.kind === "removed")).toBe(true);
  });

  it("reports correct stats for mixed edits", () => {
    const d = diffMarkdown("one\ntwo\nthree\n", "one\nTWO\nthree\nfour\n");
    expect(d.removed).toBe(1);
    expect(d.added).toBe(2);
  });

  it("diffStats counts changes without word segments", () => {
    expect(diffStats("a\nb\n", "a\nc\n")).toEqual({ added: 1, removed: 1 });
    expect(diffStats("same\n", "same\n")).toEqual({ added: 0, removed: 0 });
    expect(diffStats("", "hello\nworld\n")).toEqual({ added: 2, removed: 0 });
  });
});
