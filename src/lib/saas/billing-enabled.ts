/**
 * The deployment-wide switch for whether plans are enforced at all.
 *
 * Applying the tenancy migration makes `workspaces.plan` exist, and the column
 * defaults to 'free'. If the code treated "a plan value is present" as "billing
 * is live", then `supabase db push` would silently rate-limit every existing
 * self-hosted install — and enforce limits on a product with no checkout to
 * relieve them. Enforcing friction without offering the cure is the worst
 * possible configuration.
 *
 * So enabling billing is a deliberate second step: migrate, wire a payment
 * provider, then set the flag.
 *
 * `NEXT_PUBLIC_` is required (not just `BILLING_ENFORCED`) because the client
 * needs the same answer: it decides whether the sidebar shows plan chips and
 * whether gated buttons open an upgrade dialog or just work. That is safe — the
 * variable is *inlined into the bundle at build time*, so a visitor cannot flip
 * it, and the server enforces the same compiled-in value independently. Changing
 * it means redeploying, which is the correct amount of ceremony.
 *
 * Anything other than exactly "true" means off, including a typo like
 * `BILLING_ENFORCED=1`: silently failing to enforce would look like a working
 * billing system, whereas failing to enforce loudly is just "your limits are not
 * active", which the settings screen reports.
 */
export function isBillingEnabled(): boolean {
  return process.env.NEXT_PUBLIC_BILLING_ENFORCED === "true";
}
