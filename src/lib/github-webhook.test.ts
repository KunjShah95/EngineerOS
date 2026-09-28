import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  closingIssueUrls,
  isMergedPullRequest,
  issueDescription,
  issueEventToTaskPatch,
  PR_BODY_LIMIT,
  pullRequestToNote,
  verifyGitHubSignature,
  type GitHubIssuePayload,
  type GitHubPullRequestPayload,
} from "@/lib/github-webhook";

const sign = (secret: string, body: string) =>
  `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

describe("verifyGitHubSignature", () => {
  const body = JSON.stringify({ action: "closed" });

  it("accepts a signature made with the same secret over the same bytes", () => {
    expect(verifyGitHubSignature("s3cret", body, sign("s3cret", body))).toBe(true);
  });

  it("rejects a wrong secret, a tampered body, and malformed headers", () => {
    expect(verifyGitHubSignature("s3cret", body, sign("other", body))).toBe(false);
    expect(verifyGitHubSignature("s3cret", body + " ", sign("s3cret", body))).toBe(false);
    expect(verifyGitHubSignature("s3cret", body, null)).toBe(false);
    expect(verifyGitHubSignature("s3cret", body, "sha1=abc")).toBe(false);
    expect(verifyGitHubSignature("s3cret", body, "sha256=short")).toBe(false);
  });

  it("refuses to verify when no secret is configured", () => {
    expect(verifyGitHubSignature("", body, sign("", body))).toBe(false);
  });
});

describe("issueEventToTaskPatch", () => {
  const issue = { html_url: "https://github.com/o/r/issues/7", title: "New title", body: "New body" };
  const event = (p: Partial<GitHubIssuePayload>): GitHubIssuePayload => ({ action: "edited", issue, ...p });

  it("updates only the fields GitHub reports as changed on edit", () => {
    expect(issueEventToTaskPatch(event({ changes: { title: { from: "Old" } } }))).toEqual({ title: "New title" });
    expect(issueEventToTaskPatch(event({ changes: { body: { from: "Old" } } }))).toEqual({
      description: issueDescription(issue.html_url, "New body"),
    });
    expect(issueEventToTaskPatch(event({ changes: {} }))).toBeNull();
  });

  it("maps close/reopen to status and delete to a soft delete", () => {
    const now = new Date("2026-09-28T12:00:00Z");
    expect(issueEventToTaskPatch(event({ action: "closed" }))).toEqual({ status: "done" });
    expect(issueEventToTaskPatch(event({ action: "reopened" }))).toEqual({ status: "todo" });
    expect(issueEventToTaskPatch(event({ action: "deleted" }), now)).toEqual({ deleted_at: now.toISOString() });
  });

  it("ignores irrelevant actions, missing issues, and pull requests", () => {
    expect(issueEventToTaskPatch(event({ action: "labeled" }))).toBeNull();
    expect(issueEventToTaskPatch({ action: "closed" })).toBeNull();
    expect(issueEventToTaskPatch(event({ action: "closed", issue: { ...issue, pull_request: {} } }))).toBeNull();
  });

  it("matches the importer's description format", () => {
    expect(issueDescription("https://x/1", null)).toBe("Imported from GitHub · https://x/1");
  });
});

describe("merged pull requests", () => {
  const payload = (over: Partial<NonNullable<GitHubPullRequestPayload["pull_request"]>> = {}, action = "closed") => ({
    action,
    repository: { full_name: "acme/api" },
    pull_request: {
      number: 42,
      html_url: "https://github.com/acme/api/pull/42",
      title: "Switch queue to at-least-once",
      body: "We dropped exactly-once because the broker can't guarantee it.\n\nFixes #7, resolves acme/web#3",
      merged: true,
      merged_at: "2026-09-28T10:00:00Z",
      user: { login: "dev" },
      base: { ref: "main" },
      ...over,
    },
  });

  it("only treats a closed + merged PR as capturable", () => {
    expect(isMergedPullRequest(payload())).toBe(true);
    expect(isMergedPullRequest(payload({ merged: false }))).toBe(false);
    expect(isMergedPullRequest(payload({}, "opened"))).toBe(false);
    expect(isMergedPullRequest({ action: "closed" })).toBe(false);
  });

  it("extracts closing references, defaulting to the PR's repo and de-duplicating", () => {
    expect(closingIssueUrls("Fixes #7, resolves acme/web#3. Also fixed #7. See #9.", "acme/api")).toEqual([
      "https://github.com/acme/api/issues/7",
      "https://github.com/acme/web/issues/3",
    ]);
    expect(closingIssueUrls(null, "acme/api")).toEqual([]);
    expect(closingIssueUrls("prefixes #4", "acme/api")).toEqual([]);
  });

  it("builds a note with provenance, the why, and task links", () => {
    const p = payload();
    const urls = closingIssueUrls(p.pull_request.body, "acme/api");
    const note = pullRequestToNote(p, urls, [
      { id: "t1", title: "Queue drops messages", source_url: "https://github.com/acme/api/issues/7" },
    ]);
    expect(note.title).toBe("PR #42: Switch queue to at-least-once");
    expect(note.body_markdown).toContain("> Merged [acme/api#42](https://github.com/acme/api/pull/42) by @dev into `main` on 2026-09-28.");
    expect(note.body_markdown).toContain("We dropped exactly-once");
    expect(note.body_markdown).toContain("- [acme/api#7](https://github.com/acme/api/issues/7) · task: [Queue drops messages](/tasks?task=t1)");
    expect(note.body_markdown).toContain("- [acme/web#3](https://github.com/acme/web/issues/3)");
  });

  it("handles empty and oversized descriptions", () => {
    expect(pullRequestToNote(payload({ body: null }), [], []).body_markdown).toContain("_No description provided._");
    const big = pullRequestToNote(payload({ body: "x".repeat(PR_BODY_LIMIT + 10) }), [], []).body_markdown;
    expect(big).toContain("truncated");
    expect(big.length).toBeLessThan(PR_BODY_LIMIT + 300);
  });
});
