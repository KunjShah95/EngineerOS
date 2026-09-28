import { afterEach, describe, expect, it, vi } from "vitest";

import { deleteRepoWebhook, ensureRepoWebhook, publicWebhookUrl } from "@/lib/github";

const HOOK = "https://app.example.com/api/github/webhook";

function mockFetch(...responses: { status: number; body?: unknown }[]) {
  const fn = vi.fn();
  for (const r of responses) {
    fn.mockResolvedValueOnce(new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status }));
  }
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("ensureRepoWebhook", () => {
  it("creates a JSON hook for issues + pull_request with the secret", async () => {
    const fetch = mockFetch({ status: 200, body: [] }, { status: 201, body: { id: 99 } });
    await expect(ensureRepoWebhook("tok", "acme/api", HOOK, "s3cret")).resolves.toEqual({ status: "created", id: 99 });

    const [url, init] = fetch.mock.calls[1];
    expect(url).toBe("https://api.github.com/repos/acme/api/hooks");
    expect(JSON.parse(init.body)).toEqual({
      name: "web",
      active: true,
      events: ["issues", "pull_request"],
      config: { url: HOOK, content_type: "json", secret: "s3cret", insecure_ssl: "0" },
    });
  });

  it("leaves an existing hook for the same URL alone", async () => {
    const fetch = mockFetch({ status: 200, body: [{ config: { url: HOOK } }] });
    await expect(ensureRepoWebhook("tok", "acme/api", HOOK, "s")).resolves.toEqual({ status: "exists" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("reports missing admin rights instead of throwing", async () => {
    mockFetch({ status: 404 });
    await expect(ensureRepoWebhook("tok", "acme/api", HOOK, "s")).resolves.toEqual({ status: "no-permission" });
  });

  it("rejects repo names that could alter the API path", async () => {
    await expect(ensureRepoWebhook("tok", "acme/api/../../user", HOOK, "s")).rejects.toThrow("invalid repo");
  });
});

describe("deleteRepoWebhook", () => {
  it("treats an already-deleted hook as success", async () => {
    mockFetch({ status: 404 });
    await expect(deleteRepoWebhook("tok", "acme/api", 1)).resolves.toBeUndefined();
  });
});

describe("publicWebhookUrl", () => {
  it("builds the hook URL from a public https origin", () => {
    expect(publicWebhookUrl("https://engineeros.app/")).toBe("https://engineeros.app/api/github/webhook");
  });

  it("prefers NEXT_PUBLIC_APP_URL over the request origin", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://custom.dev");
    expect(publicWebhookUrl("https://preview.vercel.app")).toBe("https://custom.dev/api/github/webhook");
  });

  it("refuses origins GitHub can't reach", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    for (const origin of ["http://localhost:3000", "https://localhost", "https://192.168.1.4", "http://example.com", "nope"]) {
      expect(publicWebhookUrl(origin)).toBeNull();
    }
  });
});
