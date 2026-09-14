import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { MarketingNav } from "@/components/marketing/marketing-nav";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { Button } from "@/components/ui/button";

const BASE = "https://engineeros-delta.vercel.app";

export const metadata = {
  title: { absolute: "Obsidian vs EngineerOS — Feature Comparison" },
  description:
    "Obsidian vs EngineerOS compared: semantic search, AI with citations, knowledge graph, plugin ecosystem, and data ownership. Which note-taking app is right for you?",
  alternates: { canonical: `${BASE}/compare/obsidian-vs-engineeros` },
  openGraph: {
    title: "Obsidian vs EngineerOS — Feature Comparison",
    description:
      "Side-by-side comparison of Obsidian and EngineerOS across search, AI, knowledge graph, and data ownership.",
    type: "website",
    url: `${BASE}/compare/obsidian-vs-engineeros`,
    siteName: "EngineerOS",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Obsidian vs EngineerOS — Feature Comparison",
    description:
      "Side-by-side comparison of Obsidian and EngineerOS across search, AI, knowledge graph, and data ownership.",
    images: ["/og-image.png"],
  },
};

const FEATURES = [
  { feature: "Semantic search", obsidian: "Plugin required", engineerOS: "Built-in (embeddings)" },
  { feature: "AI assistant with citations", obsidian: "Plugin required", engineerOS: "Built-in" },
  { feature: "Knowledge graph", obsidian: "Manual linking", engineerOS: "Automatic from wikilinks" },
  { feature: "Data storage", obsidian: "Local files on disk", engineerOS: "Your Supabase (Postgres)" },
  { feature: "Data ownership", obsidian: "Full (local files)", engineerOS: "Full (your Supabase)" },
  { feature: "Sync", obsidian: "Paid ($4/mo) or self-host", engineerOS: "Via Supabase" },
  { feature: "Plugins", obsidian: "1000+ community plugins", engineerOS: "Built-in features" },
  { feature: "Mobile app", obsidian: "Yes (iOS + Android)", engineerOS: "Web app (mobile browser)" },
  { feature: "Collaboration", obsidian: "Limited (paid sync)", engineerOS: "Single-user focused" },
  { feature: "Pricing", obsidian: "Free + paid sync", engineerOS: "Free (self-hosted)" },
];

export default function ObsidianVsEngineerOS() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ComparisonPage",
            name: "Obsidian vs EngineerOS",
            description:
              "Side-by-side comparison of Obsidian and EngineerOS across semantic search, AI with citations, knowledge graph, and data ownership.",
            url: `${BASE}/compare/obsidian-vs-engineeros`,
            mainEntity: {
              "@type": "ItemList",
              itemListElement: [
                {
                  "@type": "SoftwareApplication",
                  name: "Obsidian",
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
              { "@type": "ListItem", position: 3, name: "Obsidian vs EngineerOS", item: `${BASE}/compare/obsidian-vs-engineeros` },
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
              Obsidian vs EngineerOS
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-secondary">
              Obsidian is the most popular local-first note-taking app with a
              massive plugin ecosystem. EngineerOS is an AI-native alternative
              with built-in semantic search, cited AI answers, and an automatic
              knowledge graph — no plugins needed. Here is how they compare.
            </p>
          </header>

          {/* Quick answer */}
          <div className="mt-10 rounded-lg border border-border-subtle bg-surface p-6">
            <p className="font-mono text-[10px] tracking-[0.18em] text-faint uppercase">
              In short
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-secondary">
              Obsidian gives you local files on disk — plain markdown, yours
              forever — with a huge plugin ecosystem for customization. You
              spend a weekend on sync and another on plugins to get search that
              works across devices. EngineerOS trades the plugin ecosystem for
              built-in features: semantic search, AI with citations, and an
              automatic knowledge graph. Both offer full data ownership. Choose
              Obsidian if you want local files and love customizing with plugins.
              Choose EngineerOS if you want AI-powered retrieval out of the box.
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
                      Obsidian
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
                      <td className="py-3 px-4 text-secondary">{row.obsidian}</td>
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
              Search: plugins vs built-in
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-secondary">
              Obsidian&apos;s search is good for a local app — it supports tags,
              backlinks, and basic fuzzy matching. For semantic search you need a
              plugin like Smart Connections or Omnisearch, and even then the
              experience varies by plugin quality and configuration.
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-secondary">
              EngineerOS has semantic search built in. Every note is
              automatically indexed using embeddings. You ask a question in plain
              English, and it finds notes by meaning — not just keywords. No
              plugins to install, configure, or update.
            </p>
          </section>

          <section className="mt-16">
            <h2 className="font-serif-display text-2xl leading-snug tracking-[-0.015em] text-foreground">
              AI: optional plugin vs core feature
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-secondary">
              Obsidian has AI plugins (Copilot, Smart Connections) that can
              answer questions about your notes. These are community-maintained
              and vary in quality. Citations are not always reliable.
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-secondary">
              EngineerOS&apos;s AI assistant is a core feature. Every answer includes
              citations back to the exact source notes. The AI is trained to be
              grounded — it says &quot;I don&apos;t know&quot; when retrieval fails rather than
              hallucinating an answer.
            </p>
          </section>

          <section className="mt-16">
            <h2 className="font-serif-display text-2xl leading-snug tracking-[-0.015em] text-foreground">
              Data ownership: local files vs your database
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-secondary">
              Obsidian stores notes as plain markdown files on your disk. This
              is the strongest data ownership model — your files are yours,
              always. The tradeoff is sync (paid or self-hosted) and the lack of
              a relational structure.
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-secondary">
              EngineerOS stores notes in your own Supabase project — a Postgres
              database under your account. You get SQL access, relationships
              between notes/tasks/projects, and pg_dump backups. The data is
              yours, but it lives in a database rather than files on disk.
            </p>
          </section>

          {/* Verdict */}
          <section className="mt-16 rounded-xl border border-border-subtle bg-surface p-8">
            <h2 className="font-serif-display text-2xl leading-snug tracking-[-0.015em] text-foreground">
              Bottom line
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-secondary">
              Choose Obsidian if you want local-first files, love customizing
              with plugins, and are comfortable setting up sync and search
              yourself. Choose EngineerOS if you want semantic search, AI with
              citations, and an automatic knowledge graph without installing
              plugins or configuring anything.
            </p>
            <div className="mt-6 flex gap-4">
              <Link href="/register">
                <Button size="lg">
                  Try EngineerOS free
                  <ArrowRight className="size-4" strokeWidth={1.75} />
                </Button>
              </Link>
              <Link href="/blog/self-hosted-second-brain-supabase-pgvector">
                <Button size="lg" variant="outline">
                  Read: Self-hosting your second brain
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
                  q: "Can I migrate my Obsidian vault to EngineerOS?",
                  a: "Yes. EngineerOS imports markdown files. Your Obsidian notes will be indexed for semantic search automatically. Links between notes using Obsidian-style [[wikilinks]] will be recognized and connected in the knowledge graph.",
                },
                {
                  q: "Does EngineerOS have plugins like Obsidian?",
                  a: "EngineerOS doesn't use a plugin model. Semantic search, AI with citations, knowledge graph, automation rules, and daily note rollover are all built-in features. This means fewer things to configure and maintain, but less customization flexibility.",
                },
                {
                  q: "Which is faster for daily use?",
                  a: "Obsidian is faster for simple note editing — it's a native desktop app. EngineerOS requires an internet connection and Supabase. However, EngineerOS's semantic search is faster than Obsidian's plugin-based search for finding notes by meaning.",
                },
                {
                  q: "Is EngineerOS really free?",
                  a: "Yes. EngineerOS is free with unlimited notes, tasks, and daily entries. Your data lives in your own Supabase project (which has a generous free tier). No credit card required.",
                },
                {
                  q: "Can I use both Obsidian and EngineerOS?",
                  a: "Some users keep Obsidian for local editing and use EngineerOS for AI-powered search and retrieval. You can export from Obsidian and import into EngineerOS, though you'll need to keep them in sync manually.",
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
