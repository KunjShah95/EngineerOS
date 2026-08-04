import type { AiProvider } from "./types";
import { getAiApiKey } from "@/lib/ai/server-config";

const BASE = "https://api.openai.com/v1";

function getKey(): string | undefined {
  return getAiApiKey() ?? process.env.OPENAI_API_KEY;
}

export const openaiProvider: AiProvider = {
  name: "openai",
  displayName: "OpenAI",
  description: "GPT-4o-mini for chat, text-embedding-3-small for embeddings, Whisper for transcription",
  isConfigured: () => Boolean(getKey()),
  async chat(messages, maxTokens = 400) {
    const key = getKey();
    if (!key) throw new Error("OpenAI API key not configured");
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        max_tokens: maxTokens,
        temperature: 0.4,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI request failed (${res.status})`);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return json.choices?.[0]?.message?.content?.trim() ?? "";
  },
  async embed(text) {
    const key = getKey();
    if (!key) throw new Error("OpenAI API key not configured");
    const res = await fetch(`${BASE}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ model: "text-embedding-3-small", input: text.slice(0, 8000) }),
    });
    if (!res.ok) throw new Error(`OpenAI embedding request failed (${res.status})`);
    const json = (await res.json()) as { data?: { embedding?: number[] }[] };
    const embedding = json.data?.[0]?.embedding;
    if (!embedding) throw new Error("OpenAI embedding request returned no data");
    return embedding;
  },
  async transcribe(audio, filename, mime) {
    const key = getKey();
    if (!key) return null;
    const bytes = new Uint8Array(audio);
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: mime }), filename);
    form.append("model", "whisper-1");
    form.append("response_format", "text");
    const res = await fetch(`${BASE}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!res.ok) throw new Error(`OpenAI transcription failed (${res.status})`);
    const transcript = (await res.text()).trim();
    return { transcript, model: "whisper-1" };
  },
};