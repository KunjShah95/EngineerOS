export interface AiProvider {
  readonly name: string;
  readonly displayName: string;
  readonly description: string;
  readonly supportsEmbeddings: boolean;
  isConfigured(): boolean;
  chat(messages: { role: string; content: string }[], maxTokens?: number): Promise<string>;
  embed(text: string): Promise<number[]>;
  transcribe(audio: Buffer, filename: string, mime: string): Promise<{ transcript: string; model: string } | null>;
}

export interface ProviderConfig {
  name: string;
  displayName: string;
  description: string;
  envVar: string;
  models: {
    chat: string;
    embedding: string;
    transcription: string;
  };
}

export type ProviderName =
  | "openai"
  | "gemini"
  | "groq"
  | "mistral"
  | "huggingface"
  | "nvidia-nim"
  | "openrouter"
  | "anthropic"
  | "cohere";

export interface AiConfig {
  provider: ProviderName;
  configured: boolean;
  providerName: string;
  model: string;
}