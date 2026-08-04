import type { AiProvider } from "./types";
import { getAiApiKey } from "@/lib/ai/server-config";

const BASE = "https://api-inference.huggingface.co";

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
  isConfigured: () => Boolean(getKey()),
  async chat(messages, maxTokens = 400) {
    const key = getKey();
    if (!key) throw new Error("HuggingFace API key not configured");
    const systemMsg = messages.find((m) => m.role === "system");
    const userMsg = messages.find((m) => m.role === "user");
    const prompt = systemMsg
      ? `${systemMsg.content}\n\n${userMsg?.content ?? ""}`
      : userMsg?.content ?? "";
    const res = await fetch(`${BASE}/models/${getChatModel()}`, {
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
    const res = await fetch(`${BASE}/models/${getEmbeddingModel()}`, {
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
  async transcribe(audio, filename, mime) {
    const key = getKey();
    if (!key) return null;
    const bytes = new Uint8Array(audio);
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: mime }), filename);
    const res = await fetch(`${BASE}/models/openai/whisper`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
      },
      body: form,
    });
    if (!res.ok) return null;
    const transcript = (await res.text()).trim();
    return { transcript, model: "whisper" };
  },
};