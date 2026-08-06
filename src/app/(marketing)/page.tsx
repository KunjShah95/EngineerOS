import { MarketingNav } from "@/components/marketing/marketing-nav";
import { LandingHero } from "@/components/marketing/landing-hero";
import { LandingMetrics } from "@/components/marketing/landing-metrics";
import { LandingFeatures } from "@/components/marketing/landing-features";
import { LandingShowcase } from "@/components/marketing/landing-showcase";
import { LandingComparison } from "@/components/marketing/landing-comparison";
import { LandingFaq } from "@/components/marketing/landing-faq";
import { LandingCta } from "@/components/marketing/landing-cta";
import { MarketingFooter } from "@/components/marketing/marketing-footer";

export const metadata = {
  title: {
    absolute: "EngineerOS — AI Workspace for Notes, Tasks & Projects",
  },
  description:
    "AI-native workspace for notes, tasks & projects. Semantic search, AI answers with citations, and a knowledge graph — all in one connected system.",
  alternates: {
    canonical: "https://engineeros-delta.vercel.app",
  },
  openGraph: {
    title: "EngineerOS — AI-native workspace for notes, tasks, and projects",
    description:
      "One connected system for notes, tasks, projects, and daily work. Semantic search, AI assistant with citations, knowledge graph, and automation rules — all in one place.",
    type: "website",
    siteName: "EngineerOS",
    locale: "en_US",
    url: "https://engineeros-delta.vercel.app",
  },
  twitter: {
    card: "summary_large_image",
    title: "EngineerOS — AI-native workspace for notes, tasks, and projects",
    description:
      "One connected system for notes, tasks, projects, and daily work. Semantic search, AI assistant with citations, knowledge graph, and automation rules.",
  },
};

export default function LandingPage() {
  const BASE = "https://engineeros-delta.vercel.app";
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "EngineerOS",
            description:
              "An AI-native workspace for engineers, researchers, and builders. Combines notes, tasks, projects, and daily entries into one connected system with semantic search, a knowledge graph, and an AI assistant with citations.",
            url: BASE,
            applicationCategory: "ProductivityApplication",
            operatingSystem: "Web",
            dateModified: "2026-08-06",
            featureList: [
              "Semantic search powered by embeddings",
              "AI assistant with source citations",
              "Knowledge graph with wikilinks",
              "Kanban task boards",
              "Daily notes with auto-rollover",
              "Automation rules for recurring tasks",
              "Self-hosted data via Supabase",
              "GitHub integration",
              "PDF chat",
              "Voice notes",
            ],
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "USD",
              availability: "https://schema.org/InStock",
              description: "Free to start — unlimited notes, tasks, and daily entries",
            },
            author: {
              "@type": "Organization",
              name: "EngineerOS",
              url: BASE,
            },
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "EngineerOS",
            url: BASE,
            description:
              "AI-native workspace for notes, tasks, projects, and daily work — with semantic search, knowledge graph, and AI assistant with citations.",
            dateModified: "2026-08-06",
            potentialAction: {
              "@type": "SearchAction",
              target: {
                "@type": "EntryPoint",
                urlTemplate: `${BASE}/notes?q={search_term_string}`,
              },
              "query-input": "required name=search_term_string",
            },
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
                name: "What is EngineerOS?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "EngineerOS is an AI-native workspace that combines notes, tasks, projects, and daily entries into one connected system. It features semantic search, a knowledge graph, an AI assistant with citations, and automation rules — all running on your own Supabase data.",
                },
              },
              {
                "@type": "Question",
                name: "What is an AI-native workspace?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "An AI-native workspace is a productivity tool built from the ground up with AI as a core feature — not bolted on as an add-on. In EngineerOS, every note, task, and daily entry is automatically indexed for semantic search, and the AI assistant can answer questions about your workspace with citations back to source notes.",
                },
              },
              {
                "@type": "Question",
                name: "How does EngineerOS search work?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "EngineerOS uses semantic search powered by embeddings. Every note, task, and daily entry is automatically indexed, so you can ask questions in plain English and get grounded answers with citations back to the exact source notes.",
                },
              },
              {
                "@type": "Question",
                name: "Is EngineerOS free?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "EngineerOS is free to start. Your data lives in your own Supabase project — no vendor lock-in, no credit card required.",
                },
              },
              {
                "@type": "Question",
                name: "How does the knowledge graph work?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "EngineerOS automatically builds a knowledge graph from wikilinks in your notes and links between tasks and notes. You can visualize connections, filter by project, and discover hidden relationships across your workspace.",
                },
              },
              {
                "@type": "Question",
                name: "Can I automate repetitive tasks?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Yes. EngineerOS includes automation rules for recurring tasks, quick captures that auto-triage by keyword, and daily rollover of unfinished work — so your daily rhythm builds itself.",
                },
              },
              {
                "@type": "Question",
                name: "Where does my data live?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Your data lives in your own Supabase project. EngineerOS connects to it via the Supabase client — no data is stored on EngineerOS servers. You own your data and can export it at any time.",
                },
              },
              {
                "@type": "Question",
                name: "What makes EngineerOS different from Notion or Obsidian?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "EngineerOS combines semantic search, AI-powered citations, and a visual knowledge graph in a single self-hosted workspace. Unlike Notion, your data is not locked in a proprietary cloud. Unlike Obsidian, it includes built-in AI search and automation without requiring plugins.",
                },
              },
              {
                "@type": "Question",
                name: "Who is EngineerOS built for?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "EngineerOS is built for engineers, researchers, and builders who want a single connected system for their notes, tasks, and projects — without vendor lock-in or AI that's disconnected from their actual work.",
                },
              },
              {
                "@type": "Question",
                name: "Does EngineerOS work as a second brain?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Yes. EngineerOS is designed as a second brain for technical builders — a place where every note, task, and decision is captured, indexed, and connected. Semantic search lets you retrieve knowledge in plain English, and the knowledge graph shows how ideas link across projects.",
                },
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
            "@type": "Organization",
            name: "EngineerOS",
            url: BASE,
            description: "AI-native workspace for engineers, researchers, and builders",
            logo: {
              "@type": "ImageObject",
              url: `${BASE}/icon.svg`,
              width: 512,
              height: 512,
            },
            contactPoint: {
              "@type": "ContactPoint",
              contactType: "customer support",
              url: "https://github.com/KunjShah95",
            },
            sameAs: [
              "https://github.com/KunjShah95",
            ],
          }),
        }}
      />
      <div className="min-h-screen bg-base text-foreground">
        <MarketingNav />
        <main>
          <LandingHero />
          <LandingMetrics />
          <LandingFeatures />
          <LandingShowcase />
          <LandingComparison />
          <LandingFaq />
          <LandingCta />
        </main>
        <MarketingFooter />
      </div>
    </>
  );
}
