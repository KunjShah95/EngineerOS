/**
 * In-memory trace store for inspection (plan §5).
 * Suitable for local dev / single-instance; production should persist to DB.
 */

import type { Trace } from "@/lib/ai/trace";

const MAX = 200;
const store: Trace[] = [];

export function saveTrace(trace: Trace): void {
  store.unshift(trace);
  if (store.length > MAX) store.length = MAX;
}

export function listTraces(limit = 50): Trace[] {
  return store.slice(0, limit);
}

export function getTrace(id: string): Trace | undefined {
  return store.find((t) => t.id === id);
}

export function clearTraces(): void {
  store.length = 0;
}