import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { MarketingNav } from "@/components/marketing/marketing-nav";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { Button } from "@/components/ui/button";

const BASE = "https://engineeros-delta.vercel.app";

export const metadata = {
  title: { absolute: "The Complete Guide to Building a Second Brain with AI" },
  description:
    "How to build a second brain that captures, organizes, and retrieves your knowledge using semantic search, AI citations, and a knowledge graph. A practical guide for engineers and researchers.",
  alternates: { canonical: `${BASE}/guides/building-a-second-brain` },
  openGraph: {
    title: "The Complete Guide to Building a Second Brain with AI",
    description:
      "How to build a second brain that captures, organizes, and retrieves your knowledge using semantic search and AI citations.",
    type: "article",
    url: `${BASE}/guides/building-a-second-brain`,
    siteName: "EngineerOS",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Complete Guide to Building a Second Brain with AI",
    description:
      "How to build a second brain that captures, organizes, and retrieves your knowledge using semantic search and AI citations.",
    images: ["/og-image.png"],
  },
};

export default function BuildingASecondBrainGuide() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: "The Complete Guide to Building a Second Brain with AI",
            description:
              "How to build a second brain that captures, organizes, and retrieves your knowledge using semantic search, AI citations, and a knowledge graph.",
            url: `${BASE}/guides/building-a-second-brain`,
            mainEntityOfPage: { "@type": "WebPage", "@id": `${BASE}/guides/building-a-second-brain` },
            datePublished: "2026-09-14",
            dateModified: "2026-09-14",
            author: {
              "@type": "Person",
              name: "Kunj Shah",
              url: "https://github.com/KunjShah95",
            },
            publisher: {
              "@type": "Organization",
              name: "EngineerOS",
              url: BASE,
              logo: { "@type": "ImageObject", url: `${BASE}/icon.svg` },
            },
            image: `${BASE}/og-image.png`,
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "HowTo",
            name: "How to build a second brain with AI",
            description:
              "A step-by-step guide to building a personal knowledge management system with semantic search, AI citations, and a knowledge graph.",
            totalTime: "PT2H",
            step: [
              {
                "@type": "HowToStep",
                name: "Capture everything",
                text: "Start by capturing notes, tasks, and daily entries in one place. Use markdown for portability. Write decisions down with reasoning, not just rules.",
              },
              {
                "@type": "HowToStep",
                name: "Set up semantic search",
                text: "Connect your notes to an embedding-powered search system. Chunk notes on markdown headings, combine semantic and keyword search via reciprocal rank fusion.",
              },
              {
                "@type": "HowToStep",
                name: "Add AI with citations",
                text: "Configure an AI assistant that answers questions with citations back to source notes. Every claim should link to where it came from so you can verify.",
              },
              {
                "@type": "HowToStep",
                name: "Build the knowledge graph",
                text: "Use wikilinks to connect related notes. The graph automatically reveals relationships across your workspace — projects, themes, and decision chains.",
              },
              {
                "@type": "HowToStep",
                name: "Automate the rhythm",
                text: "Set up recurring tasks, daily rollover, and keyword-based quick captures. Your daily rhythm should build itself so you can focus on thinking.",
              },
            ],
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
              { "@type": "ListItem", position: 2, name: "Guides", item: `${BASE}/guides` },
              { "@type": "ListItem", position: 3, name: "Building a Second Brain", item: `${BASE}/guides/building-a-second-brain` },
            ],
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              {
                "@type": "Question",
                name: "What is a second brain?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "A second brain is a personal knowledge management system that captures, organizes, and retrieves your notes, tasks, and ideas. It extends your biological memory by storing everything in one searchable, connected system — so you never lose an idea or re-derive a decision you already made.",
                },
              },
              {
                "@type": "Question",
                name: "Why do I need a second brain?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Without a second brain, you re-derive decisions you already made, lose context from past conversations, and spend time searching for things you know you wrote down somewhere. A good second brain retrieves knowledge in seconds instead of minutes, and shows you connections you didn't know existed.",
                },
              },
              {
                "@type": "Question",
                name: "What is the best second brain app?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "The best second brain app depends on your priorities. Notion excels at collaboration. Obsidian gives you local files with a plugin ecosystem. EngineerOS combines semantic search, AI with citations, and a knowledge graph in one self-hosted workspace. For engineers who want AI-powered retrieval without plugins, EngineerOS is the strongest option.",
                },
              },
              {
                "@type": "Question",
                name: "How does semantic search work in a second brain?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Semantic search converts each note into an embedding — a vector of numbers positioned so related ideas sit near each other. A query is converted the same way, then compared by cosine similarity. This means searching 'how does login work' finds a note titled 'JWT refresh flow' even without shared keywords.",
                },
              },
              {
                "@type": "Question",
                name: "Can I self-host my second brain?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Yes. Self-hosting means your notes live in a database you control — typically Postgres with pgvector for semantic search. You get SQL access, pg_dump backups, and immunity to pricing changes. The tradeoff is you handle backups and upgrades yourself, though managed Postgres makes this straightforward.",
                },
              },
            ],
          }),
        }}
      />

      <div className="min-h-screen bg-base text-foreground">
        <MarketingNav />

        <main className="mx-auto w-full max-w-3xl px-4 pt-32 pb-20 sm:px-6 md:pt-40">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.08em] text-faint uppercase transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3" strokeWidth={1.75} />
            Home
          </Link>

          <article className="mt-8">
            <header>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] tracking-[0.08em] text-faint uppercase">
                <time dateTime="2026-09-14">Sep 14, 2026</time>
                <span aria-hidden>·</span>
                <span>20 min read</span>
              </div>

              <h1 className="mt-4 font-serif-display text-[clamp(2rem,4.6vw,2.9rem)] font-normal leading-[1.08] tracking-[-0.02em] text-foreground">
                The Complete Guide to Building a Second Brain with AI
              </h1>

              <div className="mt-6 flex flex-wrap gap-2">
                {["Second brain", "AI", "Semantic search", "Productivity"].map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-border-subtle px-2.5 py-1 font-mono text-[10px] tracking-[0.06em] text-faint uppercase"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </header>

            {/* Direct answer block */}
            <div className="mt-10 border-l-2 border-[color:var(--hero-mint)] pl-5">
              <p className="font-mono text-[10px] tracking-[0.18em] text-faint uppercase">
                In short
              </p>
              <p className="mt-3 text-[15px] leading-relaxed text-secondary">
                A second brain is a personal knowledge management system that
                captures, organizes, and retrieves your notes, tasks, and ideas.
                The best second brains use semantic search to find notes by
                meaning, AI with citations to answer questions grounded in your
                own knowledge, and a knowledge graph to reveal connections you
                didn&apos;t know existed. This guide walks through building one from
                scratch.
              </p>
            </div>

            {/* Guide content */}
            <div className="mt-12 space-y-12">
              <section>
                <h2 className="font-serif-display text-2xl leading-snug tracking-[-0.015em] text-foreground">
                  Why you need a second brain
                </h2>
                <p className="mt-4 text-[15px] leading-relaxed text-secondary">
                  You wrote it down. You cannot find it. That is the problem a
                  second brain solves.
                </p>
                <p className="mt-3 text-[15px] leading-relaxed text-secondary">
                  Without a systematic approach to knowledge management, you
                  re-derive decisions you already made, lose context from past
                  conversations, and spend time searching for things you know you
                  wrote down somewhere. The expensive version is invisible —
                  nobody logs the hours lost to re-deriving. It just feels like
                  work.
                </p>
                <p className="mt-3 text-[15px] leading-relaxed text-secondary">
                  A second brain captures everything — notes, tasks, decisions,
                  daily entries — in one connected system. The value comes from
                  accumulation: the note you wrote in 2019 turning out to answer
                  a question you have in 2029.
                </p>
              </section>

              <section>
                <h2 className="font-serif-display text-2xl leading-snug tracking-[-0.015em] text-foreground">
                  Step 1: Capture everything
                </h2>
                <p className="mt-4 text-[15px] leading-relaxed text-secondary">
                  The first rule: capture first, organize later. Every note,
                  task, decision, and daily entry goes into one place. Don&apos;t
                  worry about folders or tags yet — just get it in.
                </p>
                <p className="mt-3 text-[15px] leading-relaxed text-secondary">
                  Use markdown. It&apos;s portable, readable, and will outlast every
                  note-taking app currently operating. Write decisions down with
                  reasoning, not just rules. A one-paragraph note per non-obvious
                  decision, dated, with the alternatives you rejected.
                </p>
                <p className="mt-3 text-[15px] leading-relaxed text-secondary">
                  &quot;We use pgvector over a separate vector DB because we were
                  already running Postgres and the operational cost of a second
                  datastore was not worth the recall improvement at our scale&quot;
                  survives being questioned. &quot;We use pgvector&quot; just gets
                  overruled.
                </p>
              </section>

              <section>
                <h2 className="font-serif-display text-2xl leading-snug tracking-[-0.015em] text-foreground">
                  Step 2: Set up semantic search
                </h2>
                <p className="mt-4 text-[15px] leading-relaxed text-secondary">
                  Traditional keyword search fails when you search by meaning
                  rather than exact terms. You search{" "}
                  <em>how does login work</em> and have a note titled{" "}
                  <em>JWT refresh flow</em>. Zero shared keywords, zero results.
                </p>
                <p className="mt-3 text-[15px] leading-relaxed text-secondary">
                  Semantic search converts each note into an embedding — a vector
                  of numbers positioned so related ideas sit near each other. A
                  query is converted the same way, then compared by cosine
                  similarity. The JWT note is found because the model understands
                  these concepts are related.
                </p>
                <p className="mt-3 text-[15px] leading-relaxed text-secondary">
                  Practical rules: chunk notes on markdown headings (not character
                  counts), combine semantic and keyword search via reciprocal rank
                  fusion, and always show citations so wrong answers are
                  verifiable.
                </p>
              </section>

              <section>
                <h2 className="font-serif-display text-2xl leading-snug tracking-[-0.015em] text-foreground">
                  Step 3: Add AI with citations
                </h2>
                <p className="mt-4 text-[15px] leading-relaxed text-secondary">
                  An answer without sources is unfalsifiable. It&apos;s fluent,
                  plausible, and you have no way to check it. If it&apos;s subtly
                  wrong — a date off by a month, two decisions conflated — you
                  will not catch it.
                </p>
                <p className="mt-3 text-[15px] leading-relaxed text-secondary">
                  An answer with citations is a different object. Every claim
                  links to the note it came from. You skim the sources, confirm
                  they support the claim, and move on. The failure modes become
                  visible: if the answer cites nothing relevant, you can tell the
                  retrieval missed.
                </p>
                <p className="mt-3 text-[15px] leading-relaxed text-secondary">
                  There is a second-order effect: once answers carry citations,
                  you start noticing which of your notes are load-bearing — which
                  ones keep getting cited. That is real signal about what you
                  actually know versus what you merely wrote down once.
                </p>
              </section>

              <section>
                <h2 className="font-serif-display text-2xl leading-snug tracking-[-0.015em] text-foreground">
                  Step 4: Build the knowledge graph
                </h2>
                <p className="mt-4 text-[15px] leading-relaxed text-secondary">
                  A knowledge graph shows how your notes, tasks, and projects
                  connect. Use wikilinks (like <code className="rounded bg-surface px-1.5 py-0.5 text-[13px] font-mono text-faint">[[Project Alpha]]</code>) to
                  link related notes. The graph automatically reveals
                  relationships you didn&apos;t plan.
                </p>
                <p className="mt-3 text-[15px] leading-relaxed text-secondary">
                  The graph is not a feature someone built — it is a query over
                  data that was already shaped correctly. A note linked to a task
                  linked to a project is three rows and two foreign keys. The
                  visualization makes the connections visible.
                </p>
              </section>

              <section>
                <h2 className="font-serif-display text-2xl leading-snug tracking-[-0.015em] text-foreground">
                  Step 5: Automate the rhythm
                </h2>
                <p className="mt-4 text-[15px] leading-relaxed text-secondary">
                  Your daily rhythm should build itself. Set up:
                </p>
                <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-secondary">
                  <li className="flex gap-2">
                    <span className="text-faint">-</span>
                    <span>
                      <strong>Recurring tasks</strong> — weekly reviews, monthly
                      audits, daily standups. Write them once, let them repeat.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-faint">-</span>
                    <span>
                      <strong>Daily rollover</strong> — unfinished tasks move to
                      the next day automatically. No manual migration.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-faint">-</span>
                    <span>
                      <strong>Quick captures</strong> — keyword-based rules that
                      auto-triage notes by content. Tag &quot;meeting&quot; in a note and
                      it routes to your meetings project.
                    </span>
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="font-serif-display text-2xl leading-snug tracking-[-0.015em] text-foreground">
                  The ten-year test
                </h2>
                <p className="mt-4 text-[15px] leading-relaxed text-secondary">
                  Here is the question I find clarifying:{" "}
                  <strong>
                    where do you want your notes to be in ten years?
                  </strong>
                </p>
                <p className="mt-3 text-[15px] leading-relaxed text-secondary">
                  Not next quarter. Ten years. A second brain is a compounding
                  asset — its value comes almost entirely from accumulation, from
                  the note you wrote in 2019 turning out to answer a question you
                  have in 2029. That only works if the notes survive continuously,
                  and surviving ten years means surviving pricing changes,
                  acquisitions, pivots, and at least one product decision you
                  strongly disagree with.
                </p>
                <p className="mt-3 text-[15px] leading-relaxed text-secondary">
                  A zip of markdown in a folder passes that test. A Postgres
                  dump passes it. A proprietary cloud with a lossy export button
                  probably does not, and you will not find out which until the
                  day you need it to.
                </p>
              </section>
            </div>

            {/* CTA */}
            <section className="mt-16 rounded-xl border border-border-subtle bg-surface p-8 text-center">
              <h2 className="font-serif-display text-2xl leading-snug tracking-[-0.015em] text-foreground">
                Stop re-deriving what you already knew.
              </h2>
              <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-secondary">
                EngineerOS indexes every note and task as you write, then answers
                questions with citations back to the source.
              </p>
              <div className="mt-6">
                <Link href="/register">
                  <Button size="lg">
                    Create a workspace
                    <ArrowRight className="size-4" strokeWidth={1.75} />
                  </Button>
                </Link>
              </div>
            </section>
          </article>
        </main>

        <MarketingFooter />
      </div>
    </>
  );
}
