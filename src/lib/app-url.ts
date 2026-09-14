/**
 * The canonical public origin of this deployment.
 *
 * `NEXT_PUBLIC_APP_URL` is authoritative; Vercel's `VERCEL_URL` is the fallback
 * that makes preview URLs work with no per-environment setup. `next.config.ts`
 * derives the same value for client bundles, so server-side links and
 * metadata URLs agree with what the browser sees.
 */
export function appOrigin(): string | null {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
  return configured ? configured.replace(/\/$/, "") : null;
}

/** An absolute URL for an app-relative path, or null when the origin is unset. */
export function appUrl(path: string): string | null {
  const origin = appOrigin();
  if (!origin) return null;
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}
