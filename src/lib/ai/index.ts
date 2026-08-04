export * from "../ai";
export * from "./embeddings";
export * from "./providers";

import { chunkText } from "../ai";

export function chunkForEmbedding(text: string, size = 1400, overlap = 200): string[] {
  return chunkText(text, size, overlap);
}