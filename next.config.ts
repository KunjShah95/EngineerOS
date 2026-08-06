import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Vercel exposes VERCEL_URL at build time (without the protocol) for every
// deployment — production and previews alike. Deriving NEXT_PUBLIC_APP_URL
// from it means absolute links (metadata base, email "Open task" hrefs) work
// on every preview URL with zero per-environment setup. Set the variable
// explicitly in Vercel only when you use a custom domain.
const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://plausible.io",
  "style-src 'self' 'unsafe-inline'",
  "img-src * data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");

const nextConfig: NextConfig = {
  ...(appUrl ? { env: { NEXT_PUBLIC_APP_URL: appUrl } } : {}),
  poweredByHeader: false,
  compress: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [{ key: "Content-Security-Policy", value: csp }],
      },
    ];
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "motion",
      "@tanstack/react-query",
      "radix-ui",
    ],
  },
};

export default withSentryConfig(nextConfig, {
  // Source-map upload happens only when a release token is present — set
  // SENTRY_ORG/PROJECT/AUTH_TOKEN as build-time env vars in Vercel or CI.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
});
