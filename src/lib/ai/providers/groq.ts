import type { AiProvider } from "./types";
import { getAiApiKey, getAiBaseUrl } from "@/lib/ai/server-config";

function getBase(): string {
  return getAiBaseUrl() ?? "https://api.groq.com/openai/v1";
}

function getKey(): string | undefined {
  return getAiApiKey() ?? process.env.GROQ_API_KEY;
}

function getModel(): string {
  return process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
}

export const groqProvider: AiProvider = {
  name: "groq",
  displayName: "Groq",
  description: "Llama 3.3 70B for chat, no native embeddings or transcription",
  supportsEmbeddings: false,
  isConfigured: () => Boolean(getKey()),
  async chat(messages, maxTokens = 400) {
    const key = getKey();
    if (!key) throw new Error("Groq API key not configured");
    const res = await fetch(`${getBase()}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: getModel(),
        messages,
        max_tokens: maxTokens,
        temperature: 0.4,
      }),
    });
    if (!res.ok) throw new Error(`Groq request failed (${res.status})`);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return json.choices?.[0]?.message?.content?.trim() ?? "";
  },
  async embed(_text) {
    throw new Error("Groq does not provide embedding models");
  },
  async transcribe(_audio, _filename, _mime) {
    return null;
  },
};