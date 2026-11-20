/**
 * Token-bucket limiter. In-memory, so on serverless each warm instance keeps
 * its own buckets: this blunts bursts and accidental loops, it is not a global
 * quota. Swap `Map` for Redis/KV if you need exact, shared limits.
 */
export interface Bucket {
  tokens: number;
  updatedAt: number;
}

export interface LimiterOptions {
  capacity: number;
  refillPerSecond: number;
  now?: () => number;
  maxKeys?: number;
}

export function createLimiter(opts: LimiterOptions) {
  const { capacity, refillPerSecond, now = Date.now, maxKeys = 5000 } = opts;
  const buckets = new Map<string, Bucket>();

  return {
    take(key: string): { allowed: boolean; retryAfterSeconds: number } {
      const t = now();
      let b = buckets.get(key);
      if (!b) {
        if (buckets.size >= maxKeys) {
          // Drop the oldest entry so memory stays bounded under key churn.
          const oldest = buckets.keys().next().value;
          if (oldest !== undefined) buckets.delete(oldest);
        }
        b = { tokens: capacity, updatedAt: t };
      } else {
        const elapsed = Math.max(0, (t - b.updatedAt) / 1000);
        b = { tokens: Math.min(capacity, b.tokens + elapsed * refillPerSecond), updatedAt: t };
      }
      if (b.tokens >= 1) {
        b.tokens -= 1;
        buckets.set(key, b);
        return { allowed: true, retryAfterSeconds: 0 };
      }
      buckets.set(key, b);
      return { allowed: false, retryAfterSeconds: Math.ceil((1 - b.tokens) / refillPerSecond) };
    },
  };
}
