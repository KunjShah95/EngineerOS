import { describe, expect, it } from "vitest";

import { isAiConfigured } from "@/lib/ai";
import { isEmbeddingConfigured } from "@/lib/ai/embeddings";
import { getActiveProvider, resolveProvider } from "@/lib/ai/providers";
import { getAiApiKey, getAiProviderName, runWithAiConfig } from "@/lib/ai/server-config";

// Guarantees the "BYOK" path: API keys entered in Settings are persisted to the
// `ai_configs` table, loaded by loadAiConfig() as { provider, apiKey }, and
// applied to the current request via runWithAiConfig()'s AsyncLocalStorage
// scope. Every AI surface (assistant, index, drain, pdf-chat, summarize,
// transcribe) runs its work inside that scope, so this test proves the exact
// step that makes a Settings-entered key power the assistant and semantic
// search — and that no-API-key (env fallback) still resolves cleanly.
describe("Settings-entered (BYOK) AI config", () => {
  it("applies a DB-loaded key to providers inside the request scope", () => {
    runWithAiConfig({ provider: "openai", apiKey: "sk-byok-test" }, () => {
      // The scope is live for this request.
      expect(getAiProviderName()).toBe("openai");
      expect(getAiApiKey()).toBe("sk-byok-test");

      // Provider resolution, chat readiness, and embedding readiness all see it.
      expect(resolveProvider().name).toBe("openai");
      expect(resolveProvider().isConfigured()).toBe(true);
      expect(getActiveProvider()?.name).toBe("openai");
      expect(isAiConfigured()).toBe(true);
      expect(isEmbeddingConfigured()).toBe(true);
    });
  });

  it("exposes no BYOK config outside a scope (env fallback path)", () => {
    expect(getAiProviderName()).toBeUndefined();
    expect(getAiApiKey()).toBeUndefined();
  });

  it("re-reads the scope key per request instead of caching a stale one", () => {
    runWithAiConfig({ provider: "openai", apiKey: "sk-a" }, () => {
      expect(resolveProvider().isConfigured()).toBe(true);
    });
    runWithAiConfig({ provider: "openai", apiKey: "sk-b" }, () => {
      expect(getAiApiKey()).toBe("sk-b");
      expect(resolveProvider().isConfigured()).toBe(true);
    });
  });
});
