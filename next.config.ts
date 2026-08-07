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

// React's development build requires `eval()` (for callstack reconstruction and
// other debugging features) and Turbopack HMR also relies on it, so allow
// 'unsafe-eval' in development only — never in production.
const isDev = process.env.NODE_ENV === "development";

const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  "https://plausible.io",
  "https://va.vercel-scripts.com", // Vercel Analytics (`<Analytics />`)
  ...(isDev ? ["'unsafe-eval'"] : []),
].join(" ");

const csp = [
  "default-src 'self'",
  `script-src ${scriptSrc}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src * data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss:",
  "worker-src 'self' blob:",
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
