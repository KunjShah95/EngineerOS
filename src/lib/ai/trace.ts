/**
 * Structured tracing for the assistant pipeline.
 *
 * Captures a trace from user question → retrieved chunks → tool calls → final
 * answer, with timings and token/cost estimates. Designed to be serializable
 * and inspectable (plan §1/§5). No external dependency; traces are plain
 * objects that callers persist or log.
 */

export type SpanKind =
  | "retrieval"
  | "model"
  | "tool"
  | "rerank"
  | "refusal";

export interface Span {
  id: string;
  kind: SpanKind;
  name: string;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  attributes: Record<string, unknown>;
  children: Span[];
  error?: string;
}

export interface Trace {
  id: string;
  question: string;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  spans: Span[];
  metadata: Record<string, unknown>;
}

let counter = 0;
function uid(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}

export function createTrace(question: string, metadata: Record<string, unknown> = {}): Trace {
  return {
    id: uid("trace"),
    question,
    startedAt: Date.now(),
    spans: [],
    metadata: { ...metadata },
  };
}

export function startSpan(
  trace: Trace,
  kind: SpanKind,
  name: string,
  attributes: Record<string, unknown> = {},
  parent?: Span
): Span {
  const span: Span = {
    id: uid("span"),
    kind,
    name,
    startedAt: Date.now(),
    attributes: { ...attributes },
    children: [],
  };
  if (parent) parent.children.push(span);
  else trace.spans.push(span);
  return span;
}

export function endSpan(span: Span, attributes?: Record<string, unknown>, error?: string): void {
  span.endedAt = Date.now();
  span.durationMs = span.endedAt - span.startedAt;
  if (attributes) Object.assign(span.attributes, attributes);
  if (error) span.error = error;
}

export function finishTrace(trace: Trace): Trace {
  trace.endedAt = Date.now();
  trace.durationMs = trace.endedAt - trace.startedAt;
  return trace;
}

export interface RetrievalSpanAttrs {
  strategy: string;
  k: number;
  docIds: string[];
  scores?: number[];
  misses?: string[];
}

export function recordRetrieval(
  trace: Trace,
  attrs: RetrievalSpanAttrs,
  parent?: Span
): Span {
  const span = startSpan(trace, "retrieval", "retrieve", { ...attrs }, parent);
  endSpan(span);
  return span;
}

export interface ModelSpanAttrs {
  provider: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  costUsd?: number;
  refused?: boolean;
}

export function recordModel(trace: Trace, attrs: ModelSpanAttrs, parent?: Span): Span {
  const span = startSpan(trace, "model", "generate", { ...attrs }, parent);
  endSpan(span);
  return span;
}

export function recordTool(
  trace: Trace,
  name: string,
  input: unknown,
  output: unknown,
  ok: boolean,
  durationMs?: number,
  parent?: Span
): Span {
  const span = startSpan(trace, "tool", name, { input, output, ok }, parent);
  if (durationMs !== undefined) span.durationMs = durationMs;
  endSpan(span, undefined, ok ? undefined : "tool_failed");
  return span;
}

/** Identify the first failing stage of a trace (improvement E). */
export function failingStage(trace: Trace): string | null {
  let found: string | null = null;
  const walk = (spans: Span[]) => {
    for (const s of spans) {
      if (s.error) {
        if (!found) found = `${s.kind}:${s.name}`;
      }
      if (!found) walk(s.children);
    }
  };
  walk(trace.spans);
  return found;
}

/** Reproduce a failed run as a compact, loggable summary (improvement E). */
export function reproduceTrace(trace: Trace): Record<string, unknown> {
  return {
    id: trace.id,
    question: trace.question,
    durationMs: trace.durationMs ?? 0,
    failingStage: failingStage(trace),
    summary: traceSummary(trace),
    spans: trace.spans.map((s) => ({
      kind: s.kind,
      name: s.name,
      durationMs: s.durationMs,
      error: s.error,
      attributes: s.attributes,
    })),
  };
}

export function traceSummary(trace: Trace): {
  durationMs: number;
  retrievalDocs: number;
  toolCalls: number;
  toolFailures: number;
  refused: boolean;
  totalTokens: number;
  costUsd: number;
} {
  let retrievalDocs = 0;
  let toolCalls = 0;
  let toolFailures = 0;
  let refused = false;
  let totalTokens = 0;
  let costUsd = 0;
  const walk = (spans: Span[]) => {
    for (const s of spans) {
      if (s.kind === "retrieval") {
        const ids = (s.attributes as Record<string, unknown>).docIds;
        retrievalDocs += Array.isArray(ids) ? ids.length : 0;
      }
      if (s.kind === "tool") {
        toolCalls += 1;
        if (s.attributes.ok === false) toolFailures += 1;
      }
      if (s.kind === "model") {
        totalTokens += Number(s.attributes.totalTokens ?? 0);
        costUsd += Number(s.attributes.costUsd ?? 0);
        if (s.attributes.refused === true) refused = true;
      }
      walk(s.children);
    }
  };
  walk(trace.spans);
  return {
    durationMs: trace.durationMs ?? 0,
    retrievalDocs,
    toolCalls,
    toolFailures,
    refused,
    totalTokens,
    costUsd,
  };
}