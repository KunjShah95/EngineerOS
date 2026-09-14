/**
 * Which workspace is currently active.
 *
 * Deliberately a cookie rather than localStorage: the API routes have to resolve
 * the same workspace the UI is showing, and localStorage is invisible to them.
 * A mismatch would mean you look at one workspace while writing to another.
 *
 * Not httpOnly on purpose — this is a UUID that identifies nothing secret, and
 * every consumer validates membership server-side before trusting it. The client
 * needs to read it so React Query can scope its own fetches the same way.
 */

export const ACTIVE_WORKSPACE_COOKIE = "eos.active_workspace";

/** Long enough to survive a browser restart; shorter than an account's life. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** True for a well-formed uuid. Exported so server code can validate an id
 *  sourced from a cookie without re-deriving the pattern. */
export function isWorkspaceId(value: string | null | undefined): value is string {
  return isUuid(value);
}

/** Read the active workspace id in the browser. Null when none is selected. */
export function readActiveWorkspaceFromBrowser(): string | null {
  if (typeof document === "undefined") return null;
  for (const part of document.cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === ACTIVE_WORKSPACE_COOKIE) {
      const value = decodeURIComponent(rest.join("="));
      return isUuid(value) ? value : null;
    }
  }
  return null;
}

/**
 * Persist the choice immediately on the client, before the round trip that
 * mirrors it server-side. Writing first means a query fired in the same tick as
 * a workspace switch already carries the right id.
 */
export function writeActiveWorkspaceToBrowser(id: string | null): void {
  if (typeof document === "undefined") return;
  if (!isUuid(id)) return;
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${ACTIVE_WORKSPACE_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=${MAX_AGE_SECONDS}; samesite=lax${secure}`;
}

/**
 * Normalize a candidate id against the workspaces the user can actually open.
 *
 * A stale cookie (workspace deleted, membership revoked, or a copied cookie from
 * another account) must fall back to a workspace they do have, never to a blank
 * screen. Anything not in `ids` is discarded.
 */
export function resolveActiveWorkspaceId(
  stored: string | null | undefined,
  ids: readonly string[],
  fallbackFirst = true
): string | null {
  if (isUuid(stored) && ids.includes(stored)) return stored;
  if (fallbackFirst) return ids[0] ?? null;
  return null;
}
