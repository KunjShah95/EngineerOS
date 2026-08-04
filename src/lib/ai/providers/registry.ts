import type { AiProvider, ProviderName } from "./types";
import { openaiProvider } from "./openai";
import { geminiProvider } from "./gemini";
import { groqProvider } from "./groq";
import { mistralProvider } from "./mistral";
import { huggingfaceProvider } from "./huggingface";
import { nvidiaNimProvider } from "./nvidia-nim";
import { openrouterProvider } from "./openrouter";
import { anthropicProvider } from "./anthropic";
import { cohereProvider } from "./cohere";
import { getAiProviderName } from "@/lib/ai/server-config";

const providers: Record<ProviderName, () => AiProvider> = {
  openai: () => openaiProvider,
  gemini: () => geminiProvider,
  groq: () => groqProvider,
  mistral: () => mistralProvider,
  huggingface: () => huggingfaceProvider,
  "nvidia-nim": () => nvidiaNimProvider,
  openrouter: () => openrouterProvider,
  anthropic: () => anthropicProvider,
  cohere: () => cohereProvider,
};

export function getProvider(name: ProviderName): AiProvider | null {
  const factory = providers[name];
  if (!factory) return null;
  const provider = factory();
  if (!provider.isConfigured()) return null;
  return provider;
}

export function getActiveProvider(): AiProvider | null {
  const serverProvider = getAiProviderName();
  const name = (serverProvider || process.env.AI_PROVIDER || "openai") as ProviderName;
  return getProvider(name);
}

export function listProviders(): { name: ProviderName; configured: boolean; displayName: string; description: string }[] {
  return Object.entries(providers).map(([name, factory]) => {
    const provider = factory();
    return {
      name: name as ProviderName,
      configured: provider.isConfigured(),
      displayName: provider.displayName,
      description: provider.description,
    };
  });
}

export function resolveProvider(provider?: string): AiProvider {
  const name = (provider || getAiProviderName() || process.env.AI_PROVIDER || "openai") as ProviderName;
  const providerInstance = getProvider(name);
  if (providerInstance) return providerInstance;
  const fallback = getProvider("openai");
  if (fallback) return fallback;
  throw new Error(`AI provider "${name}" is not configured. Set AI_PROVIDER and the corresponding API key.`);
}