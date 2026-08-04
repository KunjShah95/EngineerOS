import type { AiProvider } from "./types";
import { getAiApiKey } from "@/lib/ai/server-config";

const BASE = "https://api.cohere.com/v1";

function getKey(): string | undefined {
  return getAiApiKey() ?? process.env.COHERE_API_KEY;
}

function getChatModel(): string {
  return process.env.COHERE_CHAT_MODEL || "command-r-plus";
}

function getEmbeddingModel(): string {
  return process.env.COHERE_EMBEDDING_MODEL || "multilingual-22-12";
}

export const cohereProvider: AiProvider = {
  name: "cohere",
  displayName: "Cohere",
  description: "Command R Plus for chat, multilingual embeddings, no transcription",
  isConfigured: () => Boolean(getKey()),
  async chat(messages, maxTokens = 400) {
    const key = getKey();
    if (!key) throw new Error("Cohere API key not configured");
    const systemMsg = messages.find((m) => m.role === "system");
    const userMsg = messages.find((m) => m.role === "user");
    const chatHistory = messages
      .filter((m) => m.role !== "system" && m.role !== "user")
      .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", message: m.content }));
    const res = await fetch(`${BASE}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: getChatModel(),
        message: userMsg?.content ?? "",
        chat_history: chatHistory,
        preamble: systemMsg?.content,
        max_tokens: maxTokens,
        temperature: 0.4,
      }),
    });
    if (!res.ok) throw new Error(`Cohere request failed (${res.status})`);
    const json = (await res.json()) as { text?: string };
    return (json.text ?? "").trim();
  },
  async embed(text) {
    const key = getKey();
    if (!key) throw new Error("Cohere API key not configured");
    const res = await fetch(`${BASE}/embed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ model: getEmbeddingModel(), texts: [text.slice(0, 8000)] }),
    });
    if (!res.ok) throw new Error(`Cohere embedding request failed (${res.status})`);
    const json = (await res.json()) as { embeddings?: number[][] };
    const embedding = json.embeddings?.[0];
    if (!embedding) throw new Error("Cohere embedding request returned no data");
    return embedding;
  },
  async transcribe(_audio, _filename, _mime) {
    return null;
  },
};