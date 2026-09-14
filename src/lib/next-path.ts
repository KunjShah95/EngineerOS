/**
 * Validate a post-login redirect target.
 *
 * `?next=` is supplied by the URL, so it is attacker-controlled. Passing it
 * straight to `router.push` turns "log in and return to the invitation you were
 * emailed" into "log in and get sent anywhere", because browsers resolve
 * protocol-relative URLs (`//evil.example`) against the current scheme.
 *
 * So: require a leading slash, reject a second slash or backslash (both can be
 * read as protocol-relative), and reject anything with a scheme already baked in.
 */
export function safeNextPath(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (!raw || typeof raw !== "string") return fallback;
  // Only ever an absolute path on this origin.
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(raw)) return fallback;
  return raw;
}

/** Read + validate the `next` parameter from the current browser URL. */
export function nextPathFromLocation(fallback = "/dashboard"): string {
  if (typeof window === "undefined") return fallback;
  return safeNextPath(new URLSearchParams(window.location.search).get("next"), fallback);
}
