import type { AiProvider } from "./types";
import { getAiApiKey } from "@/lib/ai/server-config";

const BASE = "https://api.anthropic.com/v1";

function getKey(): string | undefined {
  return getAiApiKey() ?? process.env.ANTHROPIC_API_KEY;
}

function getModel(): string {
  return process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022";
}

function toAnthropicMessages(messages: { role: string; content: string }[]) {
  const systemMsg = messages.find((m) => m.role === "system");
  const userAssistantMsgs = messages.filter((m) => m.role !== "system");
  return {
    system: systemMsg?.content ?? "",
    messages: userAssistantMsgs.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    })),
  };
}

export const anthropicProvider: AiProvider = {
  name: "anthropic",
  displayName: "Anthropic",
  description: "Claude 3.5 Sonnet for chat, no native embeddings or transcription",
  supportsEmbeddings: false,
  isConfigured: () => Boolean(getKey()),
  async chat(messages, maxTokens = 400) {
    const key = getKey();
    if (!key) throw new Error("Anthropic API key not configured");
    const res = await fetch(`${BASE}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: getModel(),
        max_tokens: maxTokens,
        temperature: 0.4,
        ...toAnthropicMessages(messages),
      }),
    });
    if (!res.ok) throw new Error(`Anthropic request failed (${res.status})`);
    const json = (await res.json()) as { content?: { text?: string }[] };
    const text = json.content?.map((c) => c.text).join("") ?? "";
    return text.trim();
  },
  async embed(_text) {
    throw new Error("Anthropic does not provide embedding models");
  },
  async transcribe(_audio, _filename, _mime) {
    return null;
  },
};