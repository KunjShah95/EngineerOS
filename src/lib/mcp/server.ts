import { z } from "zod";

import { TRACKS, type TrackId } from "@/content/learn";
import {
  getTopicDetail,
  isLevel,
  isTrackId,
  knowledgeMap,
  learningPath,
  listTopics,
  listTracks,
  nextTopics,
  search,
} from "@/lib/learn/service";

/**
 * Minimal stateless MCP server (Streamable HTTP, JSON responses only).
 * Every request stands alone, which is what serverless needs and what remote
 * MCP clients such as xAI's Grok API, Claude and Cursor expect to be able to use.
 */

export const SERVER_INFO = { name: "engineeros-learn", title: "EngineerOS Learn", version: "1.0.0" };
export const SUPPORTED_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;

type Id = string | number | null;

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: Id;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: Id;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const ERR = {
  parse: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internal: -32603,
} as const;

const TRACK_IDS = TRACKS.map((t) => t.id) as [TrackId, ...TrackId[]];
const trackSchema = z.enum(TRACK_IDS);
const levelSchema = z.enum(["foundation", "intermediate", "advanced"]);

interface ToolDef {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run: (args: unknown) => unknown;
}

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

const TOOLS: ToolDef[] = [
  {
    name: "list_tracks",
    title: "List learning tracks",
    description:
      "List the EngineerOS learning tracks (System Design, AI Engineering, RAG Engineering) with topic counts and total study minutes. Start here to see what exists.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    run: () => listTracks(),
  },
  {
    name: "list_topics",
    title: "List topics",
    description:
      "List topic summaries, optionally filtered by track and level. Returns ids to pass to get_topic. Does not include full text.",
    inputSchema: {
      type: "object",
      properties: {
        track: { type: "string", enum: TRACK_IDS },
        level: { type: "string", enum: ["foundation", "intermediate", "advanced"] },
      },
      additionalProperties: false,
    },
    run: (args) => {
      const p = z.object({ track: trackSchema.optional(), level: levelSchema.optional() }).parse(args ?? {});
      return listTopics(p);
    },
  },
  {
    name: "get_topic",
    title: "Get a topic",
    description:
      "Get the full lesson for one topic: explanation, key points, trade-offs, practice questions, an optional build lab, plus its prerequisites and the topics it unlocks.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Topic id, e.g. 'caching' or 'agent-loop'." } },
      required: ["id"],
      additionalProperties: false,
    },
    run: (args) => {
      const { id } = z.object({ id: z.string().min(1).max(100) }).parse(args);
      const topic = getTopicDetail(id);
      if (!topic) throw new ToolError(`Unknown topic id "${id}". Use search_topics or list_topics to find valid ids.`);
      return topic;
    },
  },
  {
    name: "search_topics",
    title: "Search topics",
    description:
      "Keyword search across all topics (titles, tags, summaries, key points, body). Use for questions like 'how do I limit API usage' or 'prompt injection'.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", minLength: 2, maxLength: 200 },
        track: { type: "string", enum: TRACK_IDS },
        level: { type: "string", enum: ["foundation", "intermediate", "advanced"] },
        limit: { type: "integer", minimum: 1, maximum: 25, default: 8 },
      },
      required: ["query"],
      additionalProperties: false,
    },
    run: (args) => {
      const p = z
        .object({
          query: z.string().min(2).max(200),
          track: trackSchema.optional(),
          level: levelSchema.optional(),
          limit: z.number().int().min(1).max(25).optional(),
        })
        .parse(args);
      return search(p.query, p);
    },
  },
  {
    name: "learning_path",
    title: "Learning path to a topic",
    description:
      "Return every prerequisite topic, in a valid study order, needed to reach a target topic, with total minutes.",
    inputSchema: {
      type: "object",
      properties: { target: { type: "string", description: "Topic id to work towards." } },
      required: ["target"],
      additionalProperties: false,
    },
    run: (args) => {
      const { target } = z.object({ target: z.string().min(1).max(100) }).parse(args);
      const path = learningPath(target);
      if (!path) throw new ToolError(`Unknown topic id "${target}".`);
      return path;
    },
  },
  {
    name: "next_topics",
    title: "What to learn next",
    description:
      "Given topic ids the learner has completed, return the topics whose prerequisites are all satisfied.",
    inputSchema: {
      type: "object",
      properties: {
        completed: { type: "array", items: { type: "string" }, maxItems: 200, default: [] },
      },
      additionalProperties: false,
    },
    run: (args) => {
      const { completed } = z
        .object({ completed: z.array(z.string().max(100)).max(200).default([]) })
        .parse(args ?? {});
      return nextTopics(completed);
    },
  },
  {
    name: "get_map",
    title: "Get the knowledge map",
    description:
      "Return the whole prerequisite graph: nodes (topics) and edges (prerequisite -> dependent), including cross-track links. Useful for planning curricula.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    run: () => knowledgeMap(),
  },
];

class ToolError extends Error {}

/** Name + description of every tool, for docs pages. */
export function listToolSummaries() {
  return TOOLS.map(({ name, title, description }) => ({ name, title, description }));
}

const ok = (id: Id, result: unknown): JsonRpcResponse => ({ jsonrpc: "2.0", id, result });
const fail = (id: Id, code: number, message: string, data?: unknown): JsonRpcResponse => ({
  jsonrpc: "2.0",
  id,
  error: { code, message, ...(data !== undefined ? { data } : {}) },
});

const paramsSchema = z.object({ name: z.string(), arguments: z.unknown().optional() });
const initSchema = z.object({ protocolVersion: z.string().optional() }).passthrough();

export function negotiateVersion(requested?: string): string {
  return (SUPPORTED_VERSIONS as readonly string[]).includes(requested ?? "")
    ? (requested as string)
    : SUPPORTED_VERSIONS[0];
}

/** Handle one JSON-RPC message. Returns null for notifications (no response expected). */
export function handleMessage(raw: unknown): JsonRpcResponse | null {
  if (typeof raw !== "object" || raw === null || (raw as JsonRpcRequest).jsonrpc !== "2.0") {
    return fail(null, ERR.invalidRequest, "Invalid JSON-RPC 2.0 request");
  }
  const msg = raw as JsonRpcRequest;
  if (typeof msg.method !== "string") {
    // A response or malformed message from the client. Nothing to do.
    return msg.id !== undefined ? fail(msg.id, ERR.invalidRequest, "Missing method") : null;
  }
  const isNotification = msg.id === undefined;
  const id: Id = msg.id ?? null;

  try {
    switch (msg.method) {
      case "initialize": {
        const p = initSchema.safeParse(msg.params ?? {});
        return ok(id, {
          protocolVersion: negotiateVersion(p.success ? p.data.protocolVersion : undefined),
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions:
            "Read-only curriculum for System Design, AI Engineering and a full RAG Engineering course. Start with list_tracks, find topics with search_topics, read them with get_topic, and plan with learning_path or next_topics.",
        });
      }
      case "ping":
        return ok(id, {});
      case "tools/list":
        return ok(id, {
          tools: TOOLS.map(({ name, title, description, inputSchema }) => ({
            name,
            title,
            description,
            inputSchema,
            annotations: { title, ...READ_ONLY },
          })),
        });
      case "tools/call": {
        const parsed = paramsSchema.safeParse(msg.params);
        if (!parsed.success) return fail(id, ERR.invalidParams, "tools/call needs a tool name");
        const tool = TOOLS.find((t) => t.name === parsed.data.name);
        if (!tool) return fail(id, ERR.invalidParams, `Unknown tool: ${parsed.data.name}`);
        try {
          const out = tool.run(parsed.data.arguments);
          return ok(id, { content: [{ type: "text", text: JSON.stringify(out) }], isError: false });
        } catch (err) {
          // Tool failures are reported inside the result so the model can recover.
          const message =
            err instanceof z.ZodError
              ? `Invalid arguments: ${err.issues.map((i) => `${i.path.join(".") || "input"} ${i.message}`).join("; ")}`
              : err instanceof ToolError
                ? err.message
                : "Tool failed unexpectedly.";
          return ok(id, { content: [{ type: "text", text: message }], isError: true });
        }
      }
      default:
        if (isNotification || msg.method.startsWith("notifications/")) return null;
        return fail(id, ERR.methodNotFound, `Method not found: ${msg.method}`);
    }
  } catch {
    return isNotification ? null : fail(id, ERR.internal, "Internal error");
  }
}

export { ERR as MCP_ERRORS, isLevel, isTrackId };
