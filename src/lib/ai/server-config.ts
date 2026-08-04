import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Request-scoped AI config. Vercel serverless functions reuse warm instances
 * across requests, so a module-level mutable config would leak one user's API
 * key to the next user. Every AI route loads the workspace's config from the
 * DB and runs its AI work inside `runWithAiConfig`; providers read the key
 * back out of the request-scoped store and fall back to env vars when unset.
 */

export type AiRuntimeConfig = {
  provider: string;
  apiKey: string;
};

const storage = new AsyncLocalStorage<AiRuntimeConfig>();

export function runWithAiConfig<T>(config: AiRuntimeConfig | null, fn: () => T): T {
  if (!config) return fn();
  return storage.run(config, fn);
}

export function getAiApiKey(): string | undefined {
  return storage.getStore()?.apiKey;
}

export function getAiProviderName(): string | undefined {
  return storage.getStore()?.provider;
}
