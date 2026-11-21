/**
 * Background job reliability helpers (plan §4).
 *
 * Pure functions + a small in-memory reference queue that encode the
 * required behaviours: recovery after crash, idempotent side effects,
 * bounded backoff, stuck-job detection and retry, and observability.
 */

export type JobStatus = "queued" | "running" | "done" | "failed" | "stuck";

export interface Job {
  id: string;
  idempotencyKey: string;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  durationMs?: number;
}

export function backoffMs(attempt: number, base = 400, cap = 30000): number {
  const exp = base * Math.pow(2, Math.max(0, attempt - 1));
  return Math.min(cap, Math.round(exp));
}

export function isStuck(job: Job, now = Date.now(), thresholdMs = 60000): boolean {
  if (job.status !== "running" || !job.startedAt) return false;
  return now - job.startedAt > thresholdMs;
}

export class IdempotencyStore {
  private keys = new Set<string>();
  /** Returns true if this is the first time the key is seen (acquired). */
  acquire(key: string): boolean {
    if (this.keys.has(key)) return false;
    this.keys.add(key);
    return true;
  }
  has(key: string): boolean {
    return this.keys.has(key);
  }
  size(): number {
    return this.keys.size;
  }
}

export interface JobMetrics {
  total: number;
  queued: number;
  running: number;
  done: number;
  failed: number;
  stuck: number;
  avgDurationMs: number;
}

export class JobQueue {
  private jobs = new Map<string, Job>();
  private idempotency = new IdempotencyStore();
  private counter = 0;

  enqueue(idempotencyKey: string, maxAttempts = 3): Job {
    // idempotent enqueue: same key returns existing job
    for (const j of this.jobs.values()) {
      if (j.idempotencyKey === idempotencyKey) return j;
    }
    const job: Job = {
      id: `job_${++this.counter}`,
      idempotencyKey,
      status: "queued",
      attempts: 0,
      maxAttempts,
      createdAt: Date.now(),
    };
    this.jobs.set(job.id, job);
    return job;
  }

  claim(jobId: string, now = Date.now()): Job {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error("unknown job");
    if (job.status !== "queued") throw new Error(`cannot claim job in status ${job.status}`);
    job.status = "running";
    job.attempts += 1;
    job.startedAt = now;
    return job;
  }

  /** Try to claim next queued job; returns null if none. */
  claimNext(now = Date.now()): Job | null {
    for (const job of this.jobs.values()) {
      if (job.status === "queued") return this.claim(job.id, now);
    }
    return null;
  }

  complete(jobId: string, now = Date.now()): Job {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error("unknown job");
    if (job.status !== "running") throw new Error(`cannot complete job in status ${job.status}`);
    job.status = "done";
    job.finishedAt = now;
    job.durationMs = job.startedAt ? now - job.startedAt : 0;
    return job;
  }

  fail(jobId: string, error: string, now = Date.now()): Job {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error("unknown job");
    if (job.status !== "running") throw new Error(`cannot fail job in status ${job.status}`);
    job.lastError = error;
    job.finishedAt = now;
    job.durationMs = job.startedAt ? now - job.startedAt : 0;
    if (job.attempts >= job.maxAttempts) {
      job.status = "failed";
    } else {
      job.status = "queued"; // retry
      job.startedAt = undefined;
    }
    return job;
  }

  /** Mark stuck running jobs as stuck. */
  detectStuck(now = Date.now(), thresholdMs = 60000): Job[] {
    const stuck: Job[] = [];
    for (const job of this.jobs.values()) {
      if (isStuck(job, now, thresholdMs)) {
        job.status = "stuck";
        stuck.push(job);
      }
    }
    return stuck;
  }

  /** Re-queue stuck jobs for retry (bounded by maxAttempts). */
  retryStuck(now = Date.now()): Job[] {
    const retried: Job[] = [];
    for (const job of this.jobs.values()) {
      if (job.status === "stuck") {
        if (job.attempts >= job.maxAttempts) {
          job.status = "failed";
          job.lastError = job.lastError ?? "stuck: max attempts reached";
        } else {
          job.status = "queued";
          job.startedAt = undefined;
          retried.push(job);
        }
      }
    }
    return retried;
  }

  /** Guard a side effect with idempotency. */
  runSideEffect(key: string, effect: () => void): boolean {
    if (!this.idempotency.acquire(key)) return false;
    effect();
    return true;
  }

  get(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  metrics(now = Date.now()): JobMetrics {
    const all = [...this.jobs.values()];
    const done = all.filter((j) => j.status === "done");
    const avgDurationMs =
      done.length === 0
        ? 0
        : done.reduce((a, j) => a + (j.durationMs ?? 0), 0) / done.length;
    return {
      total: all.length,
      queued: all.filter((j) => j.status === "queued").length,
      running: all.filter((j) => j.status === "running").length,
      done: done.length,
      failed: all.filter((j) => j.status === "failed").length,
      stuck: all.filter((j) => j.status === "stuck").length,
      avgDurationMs,
    };
  }
}