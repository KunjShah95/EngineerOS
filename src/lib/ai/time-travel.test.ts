import { describe, expect, it } from "vitest";

import {
  changedSinceSummary,
  coverageNote,
  pinNote,
  retrievePinned,
  type PinnedCorpus,
  type PinnedNote,
} from "./time-travel";
import { makeSnippet } from "./rag";

const AS_OF = "2026-03-01";
const asOfMs = new Date(`${AS_OF}T23:59:59Z`).getTime();

function note(overrides: Partial<Parameters<typeof pinNote>[0]> = {}) {
  return {
    id: "n1",
    title: "Auth decision",
    body_markdown: "We use JWTs.",
    updated_at: "2026-02-20T10:00:00Z",
    created_at: "2026-01-05T10:00:00Z",
    ...overrides,
  };
}

function version(overrides: { created_at: string; body_markdown?: string; title?: string } = { created_at: "2026-02-01T10:00:00Z" }) {
  return {
    note_id: "n1",
    title: overrides.title ?? "Auth decision",
    body_markdown: overrides.body_markdown ?? "We use session cookies.",
    created_at: overrides.created_at,
  };
}

describe("pinNote", () => {
  it("uses the live body when the note was untouched after the pin", () => {
    const result = pinNote(note(), [], asOfMs);
    expect(result?.body).toBe("We use JWTs.");
    expect(result?.fromSnapshot).toBe(false);
  });

  it("uses the newest snapshot at or before the pin when the note changed later", () => {
    const result = pinNote(
      note({ updated_at: "2026-05-02T10:00:00Z" }),
      [
        version({ created_at: "2026-04-01T10:00:00Z", body_markdown: "We use OAuth." }),
        version({ created_at: "2026-02-01T10:00:00Z", body_markdown: "We use session cookies." }),
      ],
      asOfMs
    );
    expect(result?.body).toBe("We use session cookies.");
    expect(result?.fromSnapshot).toBe(true);
  });

  it("ignores snapshots taken after the pin date", () => {
    const result = pinNote(
      note({ updated_at: "2026-06-01T10:00:00Z" }),
      [
        version({ created_at: "2026-05-01T10:00:00Z", body_markdown: "Future text." }),
        version({ created_at: "2026-02-01T10:00:00Z", body_markdown: "Old text." }),
      ],
      asOfMs
    );
    expect(result?.body).toBe("Old text.");
  });

  // The critical honesty case: the live body is NOT the answer here.
  it("returns null (unpinned) when the note changed and no snapshot predates the pin", () => {
    const result = pinNote(
      note({ updated_at: "2026-05-02T10:00:00Z" }),
      [version({ created_at: "2026-04-01T10:00:00Z" })],
      asOfMs
    );
    expect(result).toBeNull();
  });

  it("keeps the historical title when a snapshot renamed the note", () => {
    const result = pinNote(
      note({ title: "Auth decision (revised)", updated_at: "2026-05-02T10:00:00Z" }),
      [version({ created_at: "2026-02-01T10:00:00Z", title: "Auth decision" })],
      asOfMs
    );
    expect(result?.title).toBe("Auth decision");
    expect(result?.titleUpdated).toBe(true);
  });
});

describe("changedSinceSummary", () => {
  const base: PinnedNote = {
    id: "n1",
    title: "Auth decision",
    body: "We use JWTs.",
    currentBody: "We use JWTs.",
    titleUpdated: false,
  };

  it("returns empty when the body is unchanged", () => {
    expect(changedSinceSummary(base)).toBe("");
  });

  it("counts added and removed lines", () => {
    const summary = changedSinceSummary({
      ...base,
      body: "line one\nline two",
      currentBody: "line one\nline two changed\nline three",
    });
    expect(summary).toContain("+");
    expect(summary).toContain("−");
  });

  it("uses singular wording for a single line", () => {
    // Trailing newlines normalized so the only delta is one appended line.
    expect(changedSinceSummary({ ...base, body: "a\n", currentBody: "a\nb\n" })).toBe("+1 line");
  });
});

describe("retrievePinned", () => {
  const corpus: PinnedCorpus = {
    pinned: [
      {
        id: "n1",
        title: "Auth decision",
        body: "We chose session cookies over raw JWTs in the browser.",
        currentBody: "We chose session cookies over raw JWTs in the browser.\nAdded CSRF notes.",
        titleUpdated: false,
      },
      {
        id: "n2",
        title: "Sprint checklist",
        body: "Ship onboarding empty states.",
        currentBody: "Ship onboarding empty states.",
        titleUpdated: false,
      },
    ],
    unpinned: [],
    empty: false,
  };

  it("ranks pinned notes and stamps the pin date on every source", () => {
    const { chunks } = retrievePinned(corpus, "auth decision cookies", AS_OF);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].source.title).toBe("Auth decision");
    expect(chunks[0].source.as_of).toBe(AS_OF);
    expect(chunks[0].source.retrieval).toBe("time-travel");
    expect(chunks[0].source.snippet).toContain("session cookies");
  });

  it("marks only the notes that actually changed since the pin", () => {
    const { chunks } = retrievePinned(corpus, "onboarding states sprint", AS_OF);
    const sprint = chunks.find((c) => c.source.title === "Sprint checklist");
    expect(sprint?.source.changed_since).toBeUndefined();
  });

  it("reports an empty corpus rather than answering from live rows", () => {
    const { chunks, empty } = retrievePinned(
      { pinned: [], unpinned: [], empty: true },
      "anything",
      AS_OF
    );
    expect(empty).toBe(true);
    expect(chunks).toHaveLength(0);
  });

  it("only reports unpinned notes the question actually touched", () => {
    const { unpinned } = retrievePinned(
      { ...corpus, unpinned: [{ title: "Sprint checklist" }, { title: "Reading list" }] },
      "sprint checklist",
      AS_OF
    );
    expect(unpinned.map((u) => u.title)).toEqual(["Sprint checklist"]);
  });
});

describe("coverageNote", () => {
  it("is empty when nothing was excluded", () => {
    expect(coverageNote([])).toBe("");
  });

  it("names the excluded notes so missing history can't be mistaken for no matches", () => {
    const note_ = coverageNote([{ title: "Auth decision" }]);
    expect(note_).toContain("Auth decision");
    expect(note_).toContain("no earlier snapshot");
  });
});

describe("makeSnippet", () => {
  it("strips markdown so the excerpt reads as prose", () => {
    expect(makeSnippet("# Title\n\nSome **bold** text")).toBe("Title Some bold text");
  });

  it("reduces links to their label and drops images", () => {
    expect(makeSnippet("See [the doc](https://x.com) and ![shot](a.png) here")).toBe(
      "See the doc and here"
    );
  });

  it("clamps long content with an ellipsis", () => {
    const out = makeSnippet("word ".repeat(200), 40);
    expect(out.length).toBeLessThanOrEqual(41);
    expect(out.endsWith("…")).toBe(true);
  });

  it("leaves short content untouched", () => {
    expect(makeSnippet("short")).toBe("short");
  });
});
