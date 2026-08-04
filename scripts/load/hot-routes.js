// k6 smoke/load test for EngineerOS's hot routes.
//
// The hot routes all sit behind Supabase Auth (cookie-based via supabase-ssr),
// so this authenticates ONCE in setup() against the Supabase Auth REST API,
// builds the `sb-<project-ref>-auth-token` session cookie the Next.js server
// middleware expects, and reuses it across all virtual users and iterations.
//
// Prereqs:
//   1. A real test user in your Supabase project (email + password).
//   2. Env vars:
//        APP_BASE_URL           e.g. https://your-app.vercel.app (or localhost:3000)
//        NEXT_PUBLIC_SUPABASE_URL
//        SUPABASE_ANON_KEY
//        TEST_EMAIL
//        TEST_PASSWORD
// Run:
//   k6 run -e APP_BASE_URL=... -e NEXT_PUBLIC_SUPABASE_URL=... \
//          -e SUPABASE_ANON_KEY=... -e TEST_EMAIL=... -e TEST_PASSWORD=... \
//          scripts/load/hot-routes.js

import http from "k6/http";
import { check, sleep } from "k6";

const APP = __ENV.APP_BASE_URL || "http://localhost:3000";
const SUPABASE_URL = __ENV.NEXT_PUBLIC_SUPABASE_URL || "";
const ANON = __ENV.SUPABASE_ANON_KEY || "";
const EMAIL = __ENV.TEST_EMAIL || "";
const PASSWORD = __ENV.TEST_PASSWORD || "";

// supabase-ssr stores the session in a cookie named sb-<project-ref>-auth-token.
// The project ref is the subdomain of the Supabase URL (e.g. "xguqmseqyfkzpaywuuym").
const REF = SUPABASE_URL ? new URL(SUPABASE_URL).hostname.split(".")[0] : "ref";
const COOKIE_NAME = `sb-${REF}-auth-token`;

export const options = {
  scenarios: {
    smoke: {
      executor: "constant-vus",
      vus: 5,
      duration: "30s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1500"],
  },
};

// Runs once before the load begins; its return value is passed to every VU.
export function setup() {
  const res = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { apikey: ANON, "Content-Type": "application/json" } }
  );
  const s = res.json();
  if (!check(res, { "login 200 + token": () => res.status === 200 && Boolean(s.access_token) })) {
    throw new Error(
      "Failed to authenticate test user — check NEXT_PUBLIC_SUPABASE_URL / SUPABASE_ANON_KEY / TEST_EMAIL / TEST_PASSWORD"
    );
  }
  const session = {
    access_token: s.access_token,
    refresh_token: s.refresh_token,
    expires_in: s.expires_in || 3600,
    expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600),
    token_type: s.token_type || "bearer",
    user: s.user,
  };
  return `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(session))}`;
}

export default function run(cookie) {
  const headers = { "Content-Type": "application/json", Cookie: cookie };

  // The AI assistant — workspace Q&A ("Summarize my open tasks" routes through
  // the structured layer, no embeddings needed, so this is representative).
  const ask = http.post(`${APP}/api/ai/assistant`, JSON.stringify({ question: "Summarize my open tasks" }), {
    headers,
  });
  check(ask, { "assistant 200": () => ask.status === 200 });

  // Semantic search endpoint (embedding-backed; watch latency/rate limits).
  const search = http.post(`${APP}/api/search/semantic`, JSON.stringify({ query: "auth migration" }), { headers });
  check(search, { "semantic 200/fallback": () => search.status === 200 });

  // Index trigger + config (cheap, but shows auth + read path under load).
  const index = http.post(`${APP}/api/ai/index`, null, { headers });
  check(index, { "index graceful": () => index.status === 200 || index.status === 502 });

  const config = http.get(`${APP}/api/ai/config`, { headers });
  check(config, { "config 200": () => config.status === 200 });

  sleep(1);
}
