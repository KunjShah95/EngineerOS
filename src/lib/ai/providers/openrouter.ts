import type { AiProvider } from "./types";
import { getAiApiKey } from "@/lib/ai/server-config";

const BASE = "https://openrouter.ai/api/v1";

function getKey(): string | undefined {
  return getAiApiKey() ?? process.env.OPENROUTER_API_KEY;
}

function getChatModel(): string {
  return process.env.OPENROUTER_CHAT_MODEL || "openai/gpt-4o-mini";
}

function getEmbeddingModel(): string {
  return process.env.OPENROUTER_EMBEDDING_MODEL || "openai/text-embedding-3-small";
}

export const openrouterProvider: AiProvider = {
  name: "openrouter",
  displayName: "OpenRouter",
  description: "Access 200+ models via OpenRouter, including OpenAI, Anthropic, and more",
  supportsEmbeddings: true,
  isConfigured: () => Boolean(getKey()),
  async chat(messages, maxTokens = 400) {
    const key = getKey();
    if (!key) throw new Error("OpenRouter API key not configured");
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        "X-Title": "EngineerOS",
      },
      body: JSON.stringify({
        model: getChatModel(),
        messages,
        max_tokens: maxTokens,
        temperature: 0.4,
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter request failed (${res.status})`);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return json.choices?.[0]?.message?.content?.trim() ?? "";
  },
  async embed(text) {
    const key = getKey();
    if (!key) throw new Error("OpenRouter API key not configured");
    const res = await fetch(`${BASE}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ model: getEmbeddingModel(), input: text.slice(0, 8000) }),
    });
    if (!res.ok) throw new Error(`OpenRouter embedding request failed (${res.status})`);
    const json = (await res.json()) as { data?: { embedding?: number[] }[] };
    const embedding = json.data?.[0]?.embedding;
    if (!embedding) throw new Error("OpenRouter embedding request returned no data");
    return embedding;
  },
  async transcribe(_audio, _filename, _mime) {
    return null;
  },
};