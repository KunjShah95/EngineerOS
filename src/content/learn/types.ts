export type TrackId = "system-design" | "ai-engineering" | "rag-engineering";

export type Level = "foundation" | "intermediate" | "advanced";

export interface Tradeoff {
  choice: string;
  upside: string;
  cost: string;
}

export interface Topic {
  /** Globally unique slug. Used in URLs, graph edges, API and MCP tool args. */
  id: string;
  track: TrackId;
  title: string;
  /** One sentence. Shown on cards, in search results and in MCP listings. */
  summary: string;
  level: Level;
  /** Course module this lesson belongs to, for tracks taught as a sequence. */
  module?: string;
  /** Rough reading + thinking time. */
  minutes: number;
  /** Topic ids that should be understood first. May cross tracks. */
  prerequisites: string[];
  tags: string[];
  /** Plain paragraphs. No markdown syntax beyond blank-line paragraph breaks. */
  body: string[];
  keyPoints: string[];
  tradeoffs?: Tradeoff[];
  /** Questions to answer out loud or on paper. */
  practice: string[];
  /** A small build that makes the idea stick. */
  lab?: string;
}

export interface Track {
  id: TrackId;
  title: string;
  tagline: string;
  description: string;
  topics: Topic[];
}
