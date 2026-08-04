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
  title: "EngineerOS — One connected system for notes, tasks, projects, and daily work",
  description:
    "EngineerOS is an AI-native workspace that captures everything — notes, tasks, projects, and daily entries — and lets you search semantically, get AI-powered answers with citations, and visualize connections as a knowledge graph.",
  openGraph: {
    title: "EngineerOS — AI-native workspace for notes, tasks, and projects",
    description:
      "One connected system for notes, tasks, projects, and daily work. Semantic search, AI assistant with citations, knowledge graph, and automation rules — all in one place.",
    type: "website",
    siteName: "EngineerOS",
    locale: "en_US",
    images: [
      {
        url: "/icon.svg",
        width: 1200,
        height: 630,
        alt: "EngineerOS — AI-native workspace for notes, tasks, and projects",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "EngineerOS — AI-native workspace for notes, tasks, and projects",
    description:
      "One connected system for notes, tasks, projects, and daily work. Semantic search, AI assistant with citations, knowledge graph, and automation rules.",
    images: ["/icon.svg"],
  },
};

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: "EngineerOS",
            description:
              "An AI-native workspace for engineers, researchers, and builders. Combines notes, tasks, projects, and daily entries into one connected system with semantic search, a knowledge graph, and an AI assistant with citations.",
            url: "https://engineerOS.app",
            applicationCategory: "ProductivityApplication",
            operatingSystem: "Web",
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "USD",
              availability: "https://schema.org/InStock",
              description: "Free to start with unlimited notes, tasks, and daily entries",
            },
            brand: {
              "@type": "Brand",
              name: "EngineerOS",
            },
            provider: {
              "@type": "Organization",
              name: "EngineerOS",
              url: "https://engineerOS.app",
              description: "AI-native workspace for engineers, researchers, and builders",
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
                  text: "EngineerOS is free to start. Your data lives in your own Supabase project — no vendor lock-in, no credit card required. See the pricing page for full details on Pro and Enterprise plans.",
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
            url: "https://engineerOS.app",
            description: "AI-native workspace for engineers, researchers, and builders",
            sameAs: [],
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
