import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  issueDescription,
  issueEventToTaskPatch,
  verifyGitHubSignature,
  type GitHubIssuePayload,
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
