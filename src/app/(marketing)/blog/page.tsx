import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { MarketingNav } from "@/components/marketing/marketing-nav";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { getSortedPosts } from "@/content/posts";

const BASE = "https://engineeros-delta.vercel.app";

export const metadata = {
  title: { absolute: "Blog — EngineerOS" },
  description:
    "Essays on AI agents, semantic search, and owning your own knowledge base. Written by the team building EngineerOS.",
  alternates: { canonical: `${BASE}/blog` },
  openGraph: {
    title: "Blog — EngineerOS",
    description:
      "Essays on AI agents, semantic search, and owning your own knowledge base.",
    type: "website",
    url: `${BASE}/blog`,
    siteName: "EngineerOS",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog — EngineerOS",
    description:
      "Essays on AI agents, semantic search, and owning your own knowledge base.",
    images: ["/og-image.png"],
  },
};

export default function BlogIndex() {
  const posts = getSortedPosts();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Blog",
            name: "EngineerOS Blog",
            url: `${BASE}/blog`,
            description:
              "Essays on AI agents, semantic search, and owning your own knowledge base.",
            publisher: { "@type": "Organization", name: "EngineerOS", url: BASE },
            blogPost: posts.map((p) => ({
              "@type": "BlogPosting",
              headline: p.title,
              description: p.description,
              url: `${BASE}/blog/${p.slug}`,
              datePublished: p.date,
              dateModified: p.updated,
            })),
          }),
        }}
      />
      <div className="min-h-screen bg-base text-foreground">
        <MarketingNav />
        <main className="mx-auto w-full max-w-3xl px-4 pt-32 pb-20 sm:px-6 md:pt-40">
          <header className="text-center">
            <p className="font-mono text-[11px] tracking-[0.18em] text-faint uppercase">
              Writing
            </p>
            <h1 className="mt-5 font-serif-display text-[clamp(2.1rem,5vw,3.1rem)] font-normal leading-[1.06] tracking-[-0.02em] text-foreground">
              Notes on context, retrieval,
              <br className="hidden sm:block" /> and keeping what you know.
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-[15px] leading-relaxed text-secondary">
              Long-form pieces on the problems behind EngineerOS — why agents
              forget your project, how semantic search actually works, and where
              your notes should live.
            </p>
          </header>

          <div className="mt-14 divide-y divide-border-subtle border-t border-border-subtle md:mt-20">
            {posts.map((post) => (
              <article key={post.slug} className="group py-8">
                <Link
                  href={`/blog/${post.slug}`}
                  className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] tracking-[0.08em] text-faint uppercase">
                    <time dateTime={post.date}>
                      {new Date(post.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        timeZone: "UTC",
                      })}
                    </time>
                    <span aria-hidden>·</span>
                    <span>{post.readingMinutes} min read</span>
                  </div>

                  <h2 className="mt-3 font-serif-display text-[clamp(1.35rem,2.6vw,1.75rem)] font-normal leading-[1.2] tracking-[-0.015em] text-foreground transition-colors group-hover:text-[color:var(--hero-mint)]">
                    {post.title}
                  </h2>

                  <p className="mt-3 text-[15px] leading-relaxed text-secondary">
                    {post.description}
                  </p>

                  <span className="mt-4 inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.08em] text-[color:var(--hero-mint)] uppercase">
                    Read
                    <ArrowRight
                      className="size-3 transition-transform group-hover:translate-x-0.5"
                      strokeWidth={1.75}
                    />
                  </span>
                </Link>
              </article>
            ))}
          </div>
        </main>
        <MarketingFooter />
      </div>
    </>
  );
}
