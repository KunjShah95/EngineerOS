import type { AiProvider } from "./types";
import { getAiApiKey } from "@/lib/ai/server-config";

const BASE = "https://generativelanguage.googleapis.com/v1beta";

function getKey(): string | undefined {
  return getAiApiKey() ?? process.env.GEMINI_API_KEY;
}

function getModel(): string {
  return process.env.GEMINI_MODEL || "gemini-2.5-flash";
}

function buildGeminiContent(message: { role: string; content: string }) {
  return { role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content }] };
}

export const geminiProvider: AiProvider = {
  name: "gemini",
  displayName: "Google Gemini",
  description: "Gemini 2.5 Flash for chat, text-embedding-004 for embeddings",
  supportsEmbeddings: true,
  isConfigured: () => Boolean(getKey()),
  async chat(messages, maxTokens = 400) {
    const key = getKey();
    if (!key) throw new Error("Gemini API key not configured");
    const model = getModel();
    const systemMsg = messages.find((m) => m.role === "system");
    const turns = messages.filter((m) => m.role !== "system").map(buildGeminiContent);
    const res = await fetch(
      `${BASE}/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(systemMsg ? { systemInstruction: { parts: [{ text: systemMsg.content }] } } : {}),
          contents: turns,
          generationConfig: {
            maxOutputTokens: maxTokens,
            temperature: 0.4,
          },
        }),
      }
    );
    if (!res.ok) throw new Error(`Gemini request failed (${res.status})`);
    const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
    return text.trim();
  },
  async embed(text) {
    const key = getKey();
    if (!key) throw new Error("Gemini API key not configured");
    const model = process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004";
    const res = await fetch(
      `${BASE}/models/${model}:embedContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: { parts: [{ text: text.slice(0, 8000) }] } }),
      }
    );
    if (!res.ok) throw new Error(`Gemini embedding request failed (${res.status})`);
    const json = (await res.json()) as { embedding?: { values?: number[] } };
    const embedding = json.embedding?.values;
    if (!embedding) throw new Error("Gemini embedding request returned no data");
    return embedding;
  },
  async transcribe(_audio, _filename, _mime) {
    return null;
  },
};
