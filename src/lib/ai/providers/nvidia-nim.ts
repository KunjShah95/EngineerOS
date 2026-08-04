import type { AiProvider } from "./types";
import { getAiApiKey } from "@/lib/ai/server-config";

function getBaseUrl(): string {
  return process.env.NVIDIA_NIM_BASE_URL || "https://ai.api.nvidia.com/v1";
}

function getKey(): string | undefined {
  return getAiApiKey() ?? process.env.NVIDIA_NIM_API_KEY;
}

function getChatModel(): string {
  return process.env.NVIDIA_NIM_CHAT_MODEL || "llama-3.1-405b-reasoning";
}

function getEmbeddingModel(): string {
  return process.env.NVIDIA_NIM_EMBEDDING_MODEL || "nv-embedqa-e5-v5";
}

export const nvidiaNimProvider: AiProvider = {
  name: "nvidia-nim",
  displayName: "NVIDIA NIM",
  description: "NVIDIA NIM endpoints for chat, embeddings, and transcription",
  isConfigured: () => Boolean(getKey()),
  async chat(messages, maxTokens = 400) {
    const key = getKey();
    if (!key) throw new Error("NVIDIA NIM API key not configured");
    const res = await fetch(`${getBaseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "Accept": "application/json",
      },
      body: JSON.stringify({
        model: getChatModel(),
        messages,
        max_tokens: maxTokens,
        temperature: 0.4,
      }),
    });
    if (!res.ok) throw new Error(`NVIDIA NIM request failed (${res.status})`);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return json.choices?.[0]?.message?.content?.trim() ?? "";
  },
  async embed(text) {
    const key = getKey();
    if (!key) throw new Error("NVIDIA NIM API key not configured");
    const res = await fetch(`${getBaseUrl()}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "Accept": "application/json",
      },
      body: JSON.stringify({ model: getEmbeddingModel(), input: text.slice(0, 8000) }),
    });
    if (!res.ok) throw new Error(`NVIDIA NIM embedding request failed (${res.status})`);
    const json = (await res.json()) as { data?: { embedding?: number[] }[] };
    const embedding = json.data?.[0]?.embedding;
    if (!embedding) throw new Error("NVIDIA NIM embedding request returned no data");
    return embedding;
  },
  async transcribe(_audio, _filename, _mime) {
    return null;
  },
};