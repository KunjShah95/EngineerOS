import { aiEngineeringTopics } from "./ai-engineering";
import { ragEngineeringTopics } from "./rag-engineering";
import { systemDesignTopics } from "./system-design";
import type { Topic, Track, TrackId } from "./types";

export type { Level, Topic, Tradeoff, Track, TrackId } from "./types";

export const TRACKS: Track[] = [
  {
    id: "system-design",
    title: "System Design",
    tagline: "Design systems that survive real traffic.",
    description:
      "From back-of-envelope numbers to sharding, queues, consistency and multi-tenancy, with worked case studies. Built around trade-offs, not diagrams to memorise.",
    topics: systemDesignTopics,
  },
  {
    id: "ai-engineering",
    title: "AI Engineering",
    tagline: "Ship AI features that keep working.",
    description:
      "Embeddings, RAG, evals, tool use, the agent loop, context and harness engineering, MCP and security. The parts that decide whether an AI product is reliable.",
    topics: aiEngineeringTopics,
  },
  {
    id: "rag-engineering",
    title: "RAG Engineering",
    tagline: "Design, build and run retrieval systems end to end.",
    description:
      "A full course in six modules: when to use RAG, ingestion and chunking, embeddings and vector stores, hybrid retrieval and reranking, grounded generation, evaluation, production operations and advanced patterns, ending in a capstone build.",
    topics: ragEngineeringTopics,
  },
];

export const ALL_TOPICS: Topic[] = TRACKS.flatMap((t) => t.topics);

const TOPIC_BY_ID = new Map(ALL_TOPICS.map((t) => [t.id, t]));
const TRACK_BY_ID = new Map(TRACKS.map((t) => [t.id, t]));

export function getTopic(id: string): Topic | undefined {
  return TOPIC_BY_ID.get(id);
}

export function getTrack(id: string): Track | undefined {
  return TRACK_BY_ID.get(id as TrackId);
}

export const SITE_URL = "https://engineeros-delta.vercel.app";

export function topicUrl(topic: Pick<Topic, "track" | "id">): string {
  return `${SITE_URL}/learn/${topic.track}/${topic.id}`;
}
