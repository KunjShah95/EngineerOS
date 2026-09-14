import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { MarketingNav } from "@/components/marketing/marketing-nav";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { Button } from "@/components/ui/button";

const BASE = "https://engineeros-delta.vercel.app";

export const metadata = {
  title: { absolute: "Notion vs EngineerOS — Feature Comparison" },
  description:
    "Notion vs EngineerOS compared: semantic search, AI with citations, knowledge graph, data ownership, and self-hosting. Which workspace is right for you?",
  alternates: { canonical: `${BASE}/compare/notion-vs-engineeros` },
  openGraph: {
    title: "Notion vs EngineerOS — Feature Comparison",
    description:
      "Side-by-side comparison of Notion and EngineerOS across search, AI, data ownership, and self-hosting.",
    type: "website",
    url: `${BASE}/compare/notion-vs-engineeros`,
    siteName: "EngineerOS",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Notion vs EngineerOS — Feature Comparison",
    description:
      "Side-by-side comparison of Notion and EngineerOS across search, AI, data ownership, and self-hosting.",
    images: ["/og-image.png"],
  },
};

const FEATURES = [
  { feature: "Semantic search", notion: "No (keyword only)", engineerOS: "Built-in (embeddings)" },
  { feature: "AI assistant with citations", notion: "No", engineerOS: "Built-in" },
  { feature: "Knowledge graph", notion: "No", engineerOS: "Automatic from wikilinks" },
  { feature: "Self-hosted data", notion: "No", engineerOS: "Yes (Supabase)" },
  { feature: "Data ownership", notion: "Partial (vendor cloud)", engineerOS: "Full (your Supabase)" },
  { feature: "Automation rules", notion: "Limited (formulas)", engineerOS: "Built-in (recurring, rollover)" },
  { feature: "Daily notes", notion: "Manual", engineerOS: "Auto-rollover" },
  { feature: "Offline mode", notion: "Partial (app)", engineerOS: "Via Supabase local" },
  { feature: "Collaboration", notion: "Excellent (real-time)", engineerOS: "Single-user focused" },
  { feature: "Export", notion: "HTML/markdown zip (lossy)", engineerOS: "Full SQL dump (pg_dump)" },
  { feature: "Pricing", notion: "Free tier + paid plans", engineerOS: "Free (self-hosted)" },
];

export default function NotionVsEngineerOS() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ComparisonPage",
            name: "Notion vs EngineerOS",
            description:
              "Side-by-side comparison of Notion and EngineerOS across semantic search, AI with citations, knowledge graph, data ownership, and self-hosting.",
            url: `${BASE}/compare/notion-vs-engineeros`,
            mainEntity: {
              "@type": "ItemList",
              itemListElement: [
                {
                  "@type": "SoftwareApplication",
                  name: "Notion",
                  applicationCategory: "ProductivityApplication",
                },
                {
                  "@type": "SoftwareApplication",
                  name: "EngineerOS",
                  applicationCategory: "ProductivityApplication",
                  url: BASE,
                },
              ],
            },
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: BASE },
              { "@type": "ListItem", position: 2, name: "Compare", item: `${BASE}/compare` },
              { "@type": "ListItem", position: 3, name: "Notion vs EngineerOS", item: `${BASE}/compare/notion-vs-engineeros` },
            ],
          }),
        }}
      />

      <div className="min-h-screen bg-base text-foreground">
        <MarketingNav />

        <main className="mx-auto w-full max-w-4xl px-4 pt-32 pb-20 sm:px-6 md:pt-40">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.08em] text-faint uppercase transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3" strokeWidth={1.75} />
            Home
          </Link>

          <header className="mt-8">
            <p className="font-mono text-[11px] tracking-[0.18em] text-faint uppercase">
              Comparison
            </p>
            <h1 className="mt-4 font-serif-display text-[clamp(2rem,4.6vw,2.9rem)] font-normal leading-[1.08] tracking-[-0.02em] text-foreground">
              Notion vs EngineerOS
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-secondary">
              Notion is the most popular collaborative workspace. EngineerOS is
              an AI-native alternative built for engineers who want semantic
              search, cited AI answers, and full data ownership. Here is how
              they compare.
            </p>
          </header>

          {/* Quick answer — the block AI engines extract */}
          <div className="mt-10 rounded-lg border border-border-subtle bg-surface p-6">
            <p className="font-mono text-[10px] tracking-[0.18em] text-faint uppercase">
              In short
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-secondary">
              Notion excels at real-time collaboration and has a mature ecosystem
              of templates and integrations. EngineerOS trades collaboration for
              built-in semantic search, AI with citations, an automatic knowledge
              graph, and full data ownership via your own Supabase project. If
              you work alone or with a small team and care about data ownership
              and AI-powered retrieval, EngineerOS is the stronger choice. If you
              need real-time multiplayer editing at scale, Notion remains the
              better option.
            </p>
          </div>

          {/* Feature comparison table */}
          <section className="mt-16">
            <h2 className="font-serif-display text-2xl leading-snug tracking-[-0.015em] text-foreground">
              Feature comparison
            </h2>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-[15px]">
                <thead>
                  <tr className="border-b border-border-subtle">
                    <th className="py-3 pr-4 font-mono text-[11px] tracking-[0.08em] text-faint uppercase">
                      Feature
                    </th>
                    <th className="py-3 px-4 font-mono text-[11px] tracking-[0.08em] text-faint uppercase">
                      Notion
                    </th>
                    <th className="py-3 pl-4 font-mono text-[11px] tracking-[0.08em] text-faint uppercase">
                      EngineerOS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {FEATURES.map((row) => (
                    <tr key={row.feature} className="border-b border-border-subtle/50">
                      <td className="py-3 pr-4 font-medium text-foreground">
                        {row.feature}
                      </td>
                      <td className="py-3 px-4 text-secondary">{row.notion}</td>
                      <td className="py-3 pl-4 text-secondary">
                        {row.engineerOS}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Deep dive sections */}
          <section className="mt-16">
            <h2 className="font-serif-display text-2xl leading-snug tracking-[-0.015em] text-foreground">
              Search: keyword vs semantic
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-secondary">
              Notion uses keyword search — you type a word, it finds documents
              containing that word. This works until you search for something by
              meaning rather than exact terms. You search{" "}
              <em>how does login work</em> and have a note titled{" "}
              <em>JWT refresh flow</em>. Zero shared keywords, zero results.
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-secondary">
              EngineerOS uses embedding-based semantic search. Every note is
              converted into a vector of numbers positioned so related ideas sit
              near each other. The same query finds the JWT note because the
              model understands these concepts are related — even without shared
              keywords.
            </p>
          </section>

          <section className="mt-16">
            <h2 className="font-serif-display text-2xl leading-snug tracking-[-0.015em] text-foreground">
              AI with citations vs no AI
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-secondary">
              Notion added an AI feature, but it generates answers without
              linking back to source notes. You cannot verify whether the answer
              is grounded in your actual notes or hallucinated from training
              data.
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-secondary">
              EngineerOS&apos;s AI assistant answers questions with citations back to
              the exact source notes. Every claim links to where it came from. If
              the answer is wrong, you can verify in four seconds instead of
              ten minutes.
            </p>
          </section>

          <section className="mt-16">
            <h2 className="font-serif-display text-2xl leading-snug tracking-[-0.015em] text-foreground">
              Data ownership
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-secondary">
              Your data in Notion lives in Notion&apos;s cloud. The export is a zip
              of HTML or markdown that loses most of the structure that made it
              useful. If Notion changes pricing or shuts down, your options are
              pay or lose the workflow.
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-secondary">
              EngineerOS stores your data in your own Supabase project — a
              Postgres database under your account. You can back it up with{" "}
              <code className="rounded bg-surface px-1.5 py-0.5 text-[13px] font-mono text-faint">
                pg_dump
              </code>
              , query it with SQL, and point a different application at it
              tomorrow. No data is stored on EngineerOS servers.
            </p>
          </section>

          {/* Verdict */}
          <section className="mt-16 rounded-xl border border-border-subtle bg-surface p-8">
            <h2 className="font-serif-display text-2xl leading-snug tracking-[-0.015em] text-foreground">
              Bottom line
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-secondary">
              Choose Notion if you need real-time collaboration at scale, have a
              large team, and are comfortable with your data living in their
              cloud. Choose EngineerOS if you work solo or with a small team,
              want semantic search and AI with citations, care about data
              ownership, and prefer a self-hosted solution you control.
            </p>
            <div className="mt-6 flex gap-4">
              <Link href="/register">
                <Button size="lg">
                  Try EngineerOS free
                  <ArrowRight className="size-4" strokeWidth={1.75} />
                </Button>
              </Link>
              <Link href="/blog/semantic-search-over-your-own-notes">
                <Button size="lg" variant="outline">
                  Read: How search works
                </Button>
              </Link>
            </div>
          </section>

          {/* FAQ */}
          <section className="mt-16">
            <h2 className="font-serif-display text-2xl leading-snug tracking-[-0.015em] text-foreground">
              Frequently asked questions
            </h2>
            <div className="mt-8 space-y-6">
              {[
                {
                  q: "Can EngineerOS replace Notion for my team?",
                  a: "EngineerOS is designed for solo builders and small teams who prioritize data ownership and AI-powered search. If your workflow depends on real-time multiplayer editing, Notion is stronger. For individual knowledge management, EngineerOS offers features Notion doesn't: semantic search, cited AI, and a knowledge graph.",
                },
                {
                  q: "Is EngineerOS free?",
                  a: "Yes. EngineerOS is free to start with unlimited notes, tasks, daily entries, semantic search, and AI assistant. Your data lives in your own Supabase project — no credit card required.",
                },
                {
                  q: "Can I import my Notion data into EngineerOS?",
                  a: "Notion exports markdown, which EngineerOS can import. However, Notion's export loses some structure (databases, relations, rollups). You'll need to re-link related notes manually after import.",
                },
                {
                  q: "Does EngineerOS have a mobile app?",
                  a: "EngineerOS is a web app that works in mobile browsers. It doesn't have a native mobile app yet. Notion has dedicated iOS and Android apps.",
                },
                {
                  q: "Which is better for personal use?",
                  a: "For personal knowledge management, EngineerOS is stronger. Semantic search, AI with citations, automatic knowledge graph, and full data ownership make it a better second brain. Notion is better for team collaboration.",
                },
              ].map((item, i) => (
                <details key={i} className="group rounded-lg border border-border-subtle bg-surface p-5">
                  <summary className="cursor-pointer font-serif-display text-[15px] font-medium leading-snug text-foreground transition-colors group-hover:text-[color:var(--hero-mint)]">
                    {item.q}
                  </summary>
                  <p className="mt-3 text-[15px] leading-relaxed text-secondary">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </section>
        </main>

        <MarketingFooter />
      </div>
    </>
  );
}
