import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { MarketingNav } from "@/components/marketing/marketing-nav";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { Button } from "@/components/ui/button";
import { PostBody } from "@/components/marketing/post-body";
import { POSTS, getPost, getSortedPosts } from "@/content/posts";

const BASE = "https://engineeros-delta.vercel.app";

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};

  const url = `${BASE}/blog/${post.slug}`;
  return {
    title: { absolute: `${post.seoTitle} — EngineerOS` },
    description: post.description,
    alternates: { canonical: url },
    openGraph: {
      title: post.seoTitle,
      description: post.description,
      type: "article",
      url,
      siteName: "EngineerOS",
      publishedTime: post.date,
      modifiedTime: post.updated,
      tags: post.tags,
      images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.seoTitle,
      description: post.description,
      images: ["/og-image.png"],
    },
  };
}

export default async function BlogPost({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const url = `${BASE}/blog/${post.slug}`;
  const others = getSortedPosts().filter((p) => p.slug !== post.slug).slice(0, 2);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.title,
            description: post.description,
            abstract: post.answer,
            url,
            mainEntityOfPage: { "@type": "WebPage", "@id": url },
            datePublished: post.date,
            dateModified: post.updated,
            keywords: post.tags.join(", "),
            wordCount: post.body.split(/\s+/).length,
            inLanguage: "en",
            image: `${BASE}/og-image.png`,
            author: { "@type": "Organization", name: "EngineerOS", url: BASE },
            publisher: {
              "@type": "Organization",
              name: "EngineerOS",
              url: BASE,
              logo: { "@type": "ImageObject", url: `${BASE}/icon.svg` },
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
              { "@type": "ListItem", position: 2, name: "Blog", item: `${BASE}/blog` },
              { "@type": "ListItem", position: 3, name: post.title, item: url },
            ],
          }),
        }}
      />

      <div className="min-h-screen bg-base text-foreground">
        <MarketingNav />

        <main className="mx-auto w-full max-w-3xl px-4 pt-32 pb-20 sm:px-6 md:pt-40">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.08em] text-faint uppercase transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3" strokeWidth={1.75} />
            All writing
          </Link>

          <article className="mt-8">
            <header>
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

              <h1 className="mt-4 font-serif-display text-[clamp(2rem,4.6vw,2.9rem)] font-normal leading-[1.08] tracking-[-0.02em] text-foreground">
                {post.title}
              </h1>

              <div className="mt-6 flex flex-wrap gap-2">
                {post.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-border-subtle px-2.5 py-1 font-mono text-[10px] tracking-[0.06em] text-faint uppercase"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </header>

            {/* Direct answer block — the passage AI engines lift, and a
                genuine TL;DR for readers who want the conclusion first. */}
            <div className="mt-10 border-l-2 border-[color:var(--hero-mint)] pl-5">
              <p className="font-mono text-[10px] tracking-[0.18em] text-faint uppercase">
                In short
              </p>
              <p className="mt-3 text-[15px] leading-relaxed text-secondary">
                {post.answer}
              </p>
            </div>

            <PostBody markdown={post.body} />
          </article>

          <section className="mt-16 border-t border-border-subtle pt-10">
            <p className="font-mono text-[11px] tracking-[0.18em] text-faint uppercase">
              Keep reading
            </p>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              {others.map((p) => (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className="group rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <h3 className="font-serif-display text-lg leading-snug tracking-[-0.01em] text-foreground transition-colors group-hover:text-[color:var(--hero-mint)]">
                    {p.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-secondary">
                    {p.description}
                  </p>
                </Link>
              ))}
            </div>
          </section>

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
        </main>

        <MarketingFooter />
      </div>
    </>
  );
}
