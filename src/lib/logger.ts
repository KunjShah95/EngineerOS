// Phase 11 — minimal structured logging for API routes.
// In production each line is a single JSON object (easy to ship to log
// search); in development it reads like a normal console message.

type LogLevel = "info" | "warn" | "error";

export function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const entry = { level, time: new Date().toISOString(), message, ...(meta ?? {}) };
  if (process.env.NODE_ENV === "production") {
    console[level](JSON.stringify(entry));
  } else {
    console[level](`[${level}]`, message, meta ?? "");
  }
}
