import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { MarketingNav } from "@/components/marketing/marketing-nav";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { PricingSection } from "@/components/marketing/pricing-section";
import { PLANS, PLAN_ORDER } from "@/lib/saas/plans";
import { appOrigin } from "@/lib/app-url";

export const metadata = {
  title: "Pricing — EngineerOS",
  description:
    "Free for one person, Pro for more context, Team for shared memory. Bring your own AI key on any plan and the assistant limit disappears.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Pricing — EngineerOS",
    description:
      "Plans for EngineerOS. Unlimited notes, tasks and search on every tier — plans add collaborators, workspaces and AI volume.",
    type: "website",
  },
};

export default function PricingPage() {
  const origin = appOrigin();
  return (
    <>
      {/* Offers carry live prices from the same catalog the app enforces, so the
          search-result price and the checkout price can't diverge. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: "EngineerOS",
            description:
              "An AI-native workspace for notes, tasks, projects and daily journaling, with semantic search, a knowledge graph, and a cited AI assistant.",
            ...(origin ? { url: `${origin}/pricing` } : {}),
            offers: PLAN_ORDER.map((id) => {
              const plan = PLANS[id];
              return {
                "@type": "Offer",
                name: `${plan.name} plan`,
                price: plan.price.monthly,
                priceCurrency: "USD",
                category: plan.price.monthly === 0 ? "Free" : "Subscription",
                description: plan.tagline,
              };
            }),
          }),
        }}
      />
      <MarketingNav />
      <main className="relative mx-auto w-full max-w-6xl px-4 pb-24 pt-28 sm:px-6">
        <header className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Pricing</p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Your notes are free. Always.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-secondary">
            Every plan includes unlimited notes, tasks, projects, daily entries,
            semantic search and the knowledge graph. Plans buy collaboration,
            separate contexts and AI volume — never your own data back.
          </p>
        </header>

        <div className="mt-14">
          <PricingSection />
        </div>

        {/* The BYOK waiver is the most surprising and most likeable rule here, so
            it gets its own paragraph instead of hiding in a limits table. */}
        <section className="mx-auto mt-16 max-w-2xl rounded-2xl border border-default bg-surface p-6">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            One AI key, no assistant limit
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-secondary">
            Every AI feature — assistant, semantic search, PDF chat, voice
            transcription — works without an account on our side. Save your own
            provider key in Settings and your assistant usage stops counting
            against any plan, because that usage is billed to your provider
            account, not to us. You are never charged twice for the same tokens.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-secondary">
            Without a key, the assistant falls back to local keyword retrieval and
            extractive answers. The app is fully usable on the free plan with no
            AI configured at all.
          </p>
        </section>

        <section className="mx-auto mt-10 max-w-2xl rounded-2xl border border-default bg-surface p-6">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Self-hosting
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-secondary">
            EngineerOS runs against your own Supabase project. Deploy it, keep your
            data on your own account, and there is nothing to pay us. Plans apply
            to hosted workspaces once billing is configured; an instance that
            hasn&apos;t enabled it enforces no limits.
          </p>
        </section>

        <div className="mt-14 text-center">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            Create your workspace
            <ArrowRight className="size-4" strokeWidth={1.75} />
          </Link>
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}
