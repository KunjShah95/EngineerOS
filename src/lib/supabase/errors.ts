/**
 * Distinguishing "this feature's schema isn't installed" from "the query failed".
 *
 * This project treats migrations as optional: the app runs against a database
 * that has never been migrated, degrading to whatever the oldest schema supports.
 * `api/search/semantic` does it for a missing RPC, `lib/ai/db-config` for a
 * missing `ai_configs` table. Any new feature that ships a migration needs the
 * same check, so it lives in one place instead of being re-derived — badly —
 * per call site.
 *
 * Postgres/PostgREST surface a missing function or table as any of: a raw SQL
 * state code, a PGRST code, or prose in `message`. All three are matched because
 * which one you get depends on how the query was built.
 */

type MaybeError = { message?: string | null; code?: string | null; details?: string | null } | null;

/** `undefined_table`. */
const MISSING_TABLE = "42P01";
/** `undefined_column`. */
const MISSING_COLUMN = "42703";
/** `undefined_function`. */
const MISSING_FUNCTION = "42883";

export function isMissingSchemaError(error: MaybeError): boolean {
  if (!error) return false;
  if (error.code === MISSING_TABLE || error.code === MISSING_COLUMN || error.code === MISSING_FUNCTION) {
    return true;
  }
  // PGRST200: "Could not find a relationship ... in the schema cache" (HTTP 400).
  // This is what PostgREST returns when the embedded table/FK doesn't exist
  // yet (tenancy migration not applied) or the schema cache is stale.
  // PGRST202: "Could not find the ... function in the schema cache" (HTTP 404).
  if (typeof error.code === "string" && error.code.startsWith("PGRST")) {
    if (
      error.code === "PGRST200" ||
      error.code === "PGRST201" ||
      error.code === "PGRST202" ||
      error.code === "PGRST404"
    ) {
      return true;
    }
    // Fall through to the message check below for any other PGRST code —
    // do not early-return false.
  }
  const haystack = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return (
    haystack.includes("does not exist") ||
    haystack.includes("in the schema cache") ||
    haystack.includes("could not find the function") ||
    haystack.includes("is not present in this version")
  );
}
