// Unit tests for the no-API-key keyword retrieval fallback (src/lib/ai/keyword.ts).

import { describe, expect, it } from "vitest";

import {
  extractiveAnswer,
  keywordScore,
  scoreCorpus,
  searchedTerms,
  tokenize,
  tokensMatch,
} from "@/lib/ai/keyword";

describe("tokenize", () => {
  it("lowercases and keeps alphanumeric tokens of length >= 2", () => {
    expect(tokenize("Auth migration 2026 PDF!")).toEqual(["auth", "migration", "2026", "pdf"]);
  });

  it("drops function words and auxiliaries", () => {
    expect(tokenize("what did I write about last week")).toEqual(["write", "last", "week"]);
  });

  it("returns an empty list for all-stopword input", () => {
    expect(tokenize("what did I do?")).toEqual([]);
  });
});

describe("tokensMatch", () => {
  it("matches exact tokens", () => {
    expect(tokensMatch("jwt", "jwt")).toBe(true);
  });

  it("matches a query as a substring of a longer corpus token", () => {
    expect(tokensMatch("auth", "oauth")).toBe(true);
  });

  it("matches a query as a prefix/stem of a corpus token", () => {
    expect(tokensMatch("auth", "authentication")).toBe(true);
    expect(tokensMatch("jwt", "jwts")).toBe(true);
  });

  it("matches a corpus token as a prefix of the query", () => {
    expect(tokensMatch("refreshing", "refresh")).toBe(true);
    expect(tokensMatch("refreshed", "refresh")).toBe(true);
  });

  it("rejects unrelated tokens", () => {
    expect(tokensMatch("jwt", "calendar")).toBe(false);
    expect(tokensMatch("auth", "art")).toBe(false);
  });
});

describe("keywordScore", () => {
  it("returns a zero score when nothing matches", () => {
    const s = keywordScore("jwt refresh", "Calendar export", "Plans for the week.");
    expect(s.score).toBe(0);
    expect(s.coverage).toBe(0);
  });

  it("boosts title matches over body-only matches", () => {
    const titleHit = keywordScore("auth", "Authentication migration", "Decisions here.");
    const bodyOnly = keywordScore("auth", "Random note", "We chose authentication via OAuth.");
    expect(titleHit.score).toBeGreaterThan(bodyOnly.score);
  });

  it("rewards coverage across distinct query terms", () => {
    const both = keywordScore("jwt refresh", "JWT", "Refresh tokens");
    const one = keywordScore("jwt refresh", "JWT", "Nothing else");
    expect(both.score).toBeGreaterThan(one.score);
    expect(both.coverage).toBe(1);
    expect(one.coverage).toBe(0.5);
  });

  it("finds notes through stems rather than exact words only", () => {
    // The concrete failure the user hit: "auth" vs a note that only says
    // "authentication" / "OAuth".
    const s = keywordScore("auth", "Decisions", "We picked OAuth with Google authentication.");
    expect(s.score).toBeGreaterThan(0);
  });
});

describe("scoreCorpus", () => {
  it("ranks docs with more matches first and drops zero-score docs", () => {
    const docs = [
      { title: "Refresh cycle", text: "We refresh the token daily" },
      { title: "JWT auth", text: "Refresh token rotation for jwt" },
      { title: "Meeting", text: "Discussed roadmap" },
    ];
    const ranked = scoreCorpus("jwt auth refresh", docs);
    expect(ranked.map((r) => r.item.title)).toEqual(["JWT auth", "Refresh cycle"]);
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });
});

describe("extractiveAnswer", () => {
  it("quotes the sentences that match the query and skips the rest", () => {
    const chunks = [
      {
        content:
          "We chose JWT for API auth. Refresh tokens rotate every 30 days. The calendar export is a separate concern.",
      },
      { content: "Roadmap discussed." },
    ];
    const answer = extractiveAnswer("JWT refresh tokens", chunks);
    expect(answer).toContain("JWT");
    expect(answer).toContain("Refresh tokens rotate every 30 days");
    expect(answer).not.toContain("calendar");
  });

  it("returns an empty string when no sentence matches", () => {
    const chunks = [{ content: "We discussed the roadmap and shipped it." }];
    expect(extractiveAnswer("jwt auth", chunks)).toBe("");
  });
});

describe("searchedTerms", () => {
  it("lists the surviving query terms for error messages", () => {
    expect(searchedTerms("what did I decide about auth?")).toBe("decide, auth");
  });

  it("falls back gracefully when every token is a stopword", () => {
    expect(searchedTerms("what did I do?")).toBe("your exact words");
  });
});
