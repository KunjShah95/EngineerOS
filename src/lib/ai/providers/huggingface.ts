import type { AiProvider } from "./types";
import { getAiApiKey, getAiBaseUrl } from "@/lib/ai/server-config";

function getBase(): string {
  return getAiBaseUrl() ?? "https://api-inference.huggingface.co";
}

function getKey(): string | undefined {
  return getAiApiKey() ?? process.env.HUGGINGFACE_API_KEY;
}

function getChatModel(): string {
  return process.env.HUGGINGFACE_CHAT_MODEL || "mistralai/Mistral-7B-Instruct-v0.3";
}

function getEmbeddingModel(): string {
  return process.env.HUGGINGFACE_EMBEDDING_MODEL || "sentence-transformers/all-MiniLM-L6-v2";
}

export const huggingfaceProvider: AiProvider = {
  name: "huggingface",
  displayName: "HuggingFace",
  description: "Chat, embeddings, and transcription via HuggingFace Inference API",
  supportsEmbeddings: true,
  isConfigured: () => Boolean(getKey()),
  async chat(messages, maxTokens = 400) {
    const key = getKey();
    if (!key) throw new Error("HuggingFace API key not configured");
    const systemMsg = messages.find((m) => m.role === "system");
    const userMsg = messages.find((m) => m.role === "user");
    const prompt = systemMsg
      ? `${systemMsg.content}\n\n${userMsg?.content ?? ""}`
      : userMsg?.content ?? "";
    const res = await fetch(`${getBase()}/models/${getChatModel()}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: maxTokens,
          temperature: 0.4,
          return_full_text: false,
        },
      }),
    });
    if (!res.ok) throw new Error(`HuggingFace request failed (${res.status})`);
    const json = (await res.json()) as string | { generated_text?: string }[];
    if (typeof json === "string") return json.trim();
    const text = json.map((r) => r.generated_text ?? "").join("").trim();
    return text;
  },
  async embed(text) {
    const key = getKey();
    if (!key) throw new Error("HuggingFace API key not configured");
    const res = await fetch(`${getBase()}/models/${getEmbeddingModel()}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ inputs: text.slice(0, 8000) }),
    });
    if (!res.ok) throw new Error(`HuggingFace embedding request failed (${res.status})`);
    const json = (await res.json()) as number[] | { error?: string };
    if (Array.isArray(json)) return json;
    throw new Error("HuggingFace embedding request returned no data");
  },
  async transcribe(audio, _filename, mime) {
    const key = getKey();
    if (!key) return null;
    const res = await fetch(`${getBase()}/models/openai/whisper-large-v3`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": mime,
      },
      body: new Uint8Array(audio),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { text?: string };
    const transcript = json.text?.trim() ?? "";
    if (!transcript) return null;
    return { transcript, model: "whisper-large-v3" };
  },
};