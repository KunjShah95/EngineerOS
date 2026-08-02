// Server-only embedding helpers. When OPENAI_API_KEY is absent we return a
// deterministic local fingerprint vector so the pipeline still runs and the
// app is testable without a provider. When present we use text-embedding-3-small.

const OPENAI_BASE = "https://api.openai.com/v1";
const EMBED_DIM = 1536;

export function isEmbeddbConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

// Deterministic, stable 1536-d vector from a string, for the no-key path.
// Not semantically meaningful, but consistent, so similarity is still
// computed between identical/near-identical texts.
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
  if (!isEmbeddbConfigured()) return localFingerprint(text);
  const res = await fetch(`${OPENAI_BASE}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text.slice(0, 8000) }),
  });
  if (!res.ok) throw new Error(`Embedding request failed (${res.status})`);
  const json = (await res.json()) as { data?: { embedding?: number[] }[] };
  return json.data?.[0]?.embedding ?? localFingerprint(text);
}

// Queries are embedded with the same provider so both sides live in the same
// vector space.
export function embedQuery(query: string): Promise<number[]> {
  return embedText(query);
}