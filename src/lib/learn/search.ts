import { ALL_TOPICS, type Topic } from "@/content/learn";

export interface SearchHit {
  id: string;
  track: Topic["track"];
  title: string;
  summary: string;
  level: Topic["level"];
  score: number;
}

const STOP = new Set(["a", "an", "the", "and", "or", "of", "to", "in", "for", "on", "is", "how", "what", "do", "i", "my", "with"]);

export function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

function scoreTopic(topic: Topic, terms: string[]): number {
  const title = topic.title.toLowerCase();
  const tags = topic.tags.map((t) => t.toLowerCase());
  const summary = topic.summary.toLowerCase();
  const points = topic.keyPoints.join(" ").toLowerCase();
  const body = topic.body.join(" ").toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (title.includes(term)) score += 6;
    if (tags.some((t) => t === term)) score += 5;
    else if (tags.some((t) => t.includes(term))) score += 3;
    if (summary.includes(term)) score += 3;
    if (points.includes(term)) score += 2;
    if (body.includes(term)) score += 1;
  }
  return score;
}

/** Small, dependency-free keyword ranking. Good enough for ~100 topics; swap for embeddings if the corpus grows. */
export function searchTopics(
  query: string,
  opts: { track?: Topic["track"]; level?: Topic["level"]; limit?: number } = {},
  topics: Topic[] = ALL_TOPICS
): SearchHit[] {
  const terms = tokenize(query);
  if (terms.length === 0) return [];
  const limit = Math.min(Math.max(opts.limit ?? 8, 1), 25);
  return topics
    .filter((t) => (!opts.track || t.track === opts.track) && (!opts.level || t.level === opts.level))
    .map((t) => ({ t, score: scoreTopic(t, terms) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.t.title.localeCompare(b.t.title))
    .slice(0, limit)
    .map(({ t, score }) => ({
      id: t.id,
      track: t.track,
      title: t.title,
      summary: t.summary,
      level: t.level,
      score,
    }));
}
