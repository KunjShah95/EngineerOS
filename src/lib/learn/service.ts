import {
  ALL_TOPICS,
  TRACKS,
  getTopic,
  topicUrl,
  type Level,
  type Topic,
  type TrackId,
} from "@/content/learn";
import { buildGraph, pathTo, readyToLearn, totalMinutes, unlocks } from "./graph";
import { searchTopics } from "./search";

/**
 * One read-only service used by the REST API and the MCP server, so bots and
 * humans always see the same shape and the same data.
 */

const brief = (t: Topic) => ({
  id: t.id,
  track: t.track,
  title: t.title,
  summary: t.summary,
  level: t.level,
  minutes: t.minutes,
  url: topicUrl(t),
});

export type TopicBrief = ReturnType<typeof brief>;

export function listTracks() {
  return TRACKS.map((t) => ({
    id: t.id,
    title: t.title,
    tagline: t.tagline,
    description: t.description,
    topicCount: t.topics.length,
    totalMinutes: t.topics.reduce((s, x) => s + x.minutes, 0),
  }));
}

export function listTopics(filter: { track?: TrackId; level?: Level } = {}): TopicBrief[] {
  return ALL_TOPICS.filter(
    (t) => (!filter.track || t.track === filter.track) && (!filter.level || t.level === filter.level)
  ).map(brief);
}

export function getTopicDetail(id: string) {
  const t = getTopic(id);
  if (!t) return null;
  return {
    ...brief(t),
    tags: t.tags,
    body: t.body,
    keyPoints: t.keyPoints,
    tradeoffs: t.tradeoffs ?? [],
    practice: t.practice,
    lab: t.lab ?? null,
    prerequisites: t.prerequisites.map((p) => getTopic(p)).filter((x): x is Topic => !!x).map(brief),
    unlocks: unlocks(t.id).map(brief),
  };
}

export function search(query: string, opts: { track?: TrackId; level?: Level; limit?: number } = {}) {
  return searchTopics(query, opts).map((h) => ({ ...h, url: topicUrl(h) }));
}

export function learningPath(target: string) {
  const path = pathTo(target);
  if (path.length === 0) return null;
  return {
    target,
    steps: path.map(brief),
    totalMinutes: totalMinutes(path.map((t) => t.id)),
  };
}

export function nextTopics(completed: string[]) {
  const known = completed.filter((id) => getTopic(id));
  return {
    completed: known,
    unknownIds: completed.filter((id) => !getTopic(id)),
    ready: readyToLearn(known).map(brief),
  };
}

export function knowledgeMap() {
  const g = buildGraph();
  return {
    nodes: g.nodes.map(({ id, title, track, level, minutes, depth }) => ({ id, title, track, level, minutes, depth })),
    edges: g.edges.map(({ from, to, crossTrack }) => ({ from, to, crossTrack })),
  };
}

export function isTrackId(v: unknown): v is TrackId {
  return TRACKS.some((t) => t.id === v);
}

export function isLevel(v: unknown): v is Level {
  return v === "foundation" || v === "intermediate" || v === "advanced";
}
