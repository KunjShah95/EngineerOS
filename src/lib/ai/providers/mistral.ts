import type { AiProvider } from "./types";
import { getAiApiKey } from "@/lib/ai/server-config";

const BASE = "https://api.mistral.ai/v1";

function getKey(): string | undefined {
  return getAiApiKey() ?? process.env.MISTRAL_API_KEY;
}

function getChatModel(): string {
  return process.env.MISTRAL_CHAT_MODEL || "mistral-small-latest";
}

function getEmbeddingModel(): string {
  return process.env.MISTRAL_EMBEDDING_MODEL || "mistral-embed";
}

export const mistralProvider: AiProvider = {
  name: "mistral",
  displayName: "Mistral AI",
  description: "Mistral Small for chat, Mistral Embed for embeddings",
  isConfigured: () => Boolean(getKey()),
  async chat(messages, maxTokens = 400) {
    const key = getKey();
    if (!key) throw new Error("Mistral API key not configured");
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: getChatModel(),
        messages,
        max_tokens: maxTokens,
        temperature: 0.4,
      }),
    });
    if (!res.ok) throw new Error(`Mistral request failed (${res.status})`);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return json.choices?.[0]?.message?.content?.trim() ?? "";
  },
  async embed(text) {
    const key = getKey();
    if (!key) throw new Error("Mistral API key not configured");
    const res = await fetch(`${BASE}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ model: getEmbeddingModel(), input: text.slice(0, 8000) }),
    });
    if (!res.ok) throw new Error(`Mistral embedding request failed (${res.status})`);
    const json = (await res.json()) as { data?: { embedding?: number[] }[] };
    const embedding = json.data?.[0]?.embedding;
    if (!embedding) throw new Error("Mistral embedding request returned no data");
    return embedding;
  },
  async transcribe(_audio, _filename, _mime) {
    return null;
  },
};