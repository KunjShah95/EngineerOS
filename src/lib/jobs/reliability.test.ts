import { describe, expect, it } from "vitest";
import { JobQueue, backoffMs, isStuck } from "./reliability";

describe("jobs reliability", () => {
  it("backoff grows and caps", () => {
    expect(backoffMs(1)).toBe(400);
    expect(backoffMs(2)).toBe(800);
    expect(backoffMs(10)).toBeLessThanOrEqual(30000);
  });

  it("idempotent enqueue returns same job", () => {
    const q = new JobQueue();
    const a = q.enqueue("k1");
    const b = q.enqueue("k1");
    expect(a.id).toBe(b.id);
  });

  it("duplicate side effect prevented", () => {
    const q = new JobQueue();
    let count = 0;
    expect(q.runSideEffect("x", () => (count += 1))).toBe(true);
    expect(q.runSideEffect("x", () => (count += 1))).toBe(false);
    expect(count).toBe(1);
  });

  it("job recovers after crash: stays queued on failure under max attempts", () => {
    const q = new JobQueue();
    const job = q.enqueue("k2", 3);
    q.claim(job.id);
    const failed = q.fail(job.id, "crash");
    expect(failed.status).toBe("queued");
    // can be reclaimed
    const reclaimed = q.claim(failed.id);
    expect(reclaimed.attempts).toBe(2);
  });

  it("max attempts marks failed", () => {
    const q = new JobQueue();
    const job = q.enqueue("k3", 1);
    q.claim(job.id);
    const failed = q.fail(job.id, "boom");
    expect(failed.status).toBe("failed");
  });

  it("stuck detection and retry", () => {
    const q = new JobQueue();
    const job = q.enqueue("k4", 3);
    q.claim(job.id, 1000);
    const stuck = q.detectStuck(1000 + 61000, 60000);
    expect(stuck.length).toBe(1);
    expect(isStuck(q.get(job.id)!, 1000 + 61000, 60000)).toBe(false); // status now stuck
    const retried = q.retryStuck();
    expect(retried.length).toBe(1);
    expect(q.get(job.id)!.status).toBe("queued");
  });

  it("metrics observable", () => {
    const q = new JobQueue();
    const j = q.enqueue("k5");
    q.claim(j.id);
    q.complete(j.id);
    const m = q.metrics();
    expect(m.done).toBe(1);
    expect(m.avgDurationMs).toBeGreaterThanOrEqual(0);
  });

  it("duplicate execution does not duplicate side effects via idempotency", () => {
    const q = new JobQueue();
    const j = q.enqueue("k6");
    q.claim(j.id);
    q.complete(j.id);
    // re-enqueue same key returns same job, no new side effect
    const j2 = q.enqueue("k6");
    expect(j2.id).toBe(j.id);
  });
});