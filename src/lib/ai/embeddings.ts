import { resolveProvider } from "./providers";

const EMBED_DIM = 1536;

export function isEmbeddingConfigured(): boolean {
  try {
    const provider = resolveProvider();
    return provider.isConfigured();
  } catch {
    return false;
  }
}

function localFingerprint(text: string): number[] {
  const vec = new Array<number>(EMBED_DIM).fill(0);
  const words = text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
  for (const w of words) {
    const h1 = hash32("s:" + w);
    const h2 = hash32("h:" + w);
    const idx = Math.abs(h1) % EMBED_DIM;
    vec[idx] += (Math.abs(h2) % 1000) / 1000 + 0.001;
  }
  const norm = Math.sqrt(vec.reduce((a, b) => a + b * b, 0)) || 1;
  return vec.map((v) => v / norm);
}

function hash32(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >> 0;
}

export async function embedText(text: string): Promise<number[]> {
  if (!isEmbeddingConfigured()) return localFingerprint(text);
  const provider = resolveProvider();
  return provider.embed(text);
}

export function embedQuery(query: string): Promise<number[]> {
  return embedText(query);
}