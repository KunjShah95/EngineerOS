import { MarketingNav } from "@/components/marketing/marketing-nav";
import { LandingHero } from "@/components/marketing/landing-hero";
import { LandingMetrics } from "@/components/marketing/landing-metrics";
import { LandingTracks } from "@/components/marketing/landing-tracks";
import { LandingMap } from "@/components/marketing/landing-map";
import { LandingAgents } from "@/components/marketing/landing-agents";
import { LandingCourse } from "@/components/marketing/landing-course";
import { LandingOffer } from "@/components/marketing/landing-offer";
import type { BootLine } from "@/components/marketing/landing-hero";
import { ALL_TOPICS, SITE_URL, TRACKS } from "@/content/learn";
import { buildGraph, pathTo, readyToLearn, totalMinutes } from "@/lib/learn/graph";
import { listToolSummaries } from "@/lib/mcp/server";
import { searchTopics } from "@/lib/learn/search";
import { LandingFeatures } from "@/components/marketing/landing-features";
import { LandingProof } from "@/components/marketing/landing-proof";
import { LandingComparison } from "@/components/marketing/landing-comparison";
import { LandingFaq } from "@/components/marketing/landing-faq";
import { LandingCta } from "@/components/marketing/landing-cta";
import { MarketingFooter } from "@/components/marketing/marketing-footer";

export const metadata = {
  title: {
    absolute: "EngineerOS — learn system design & AI engineering",
  },
  description:
    "Short lessons on system design and AI engineering, an interactive knowledge map, and an MCP server your Grok, Claude and Cursor agents can use. Plus an AI-native workspace for notes, tasks and projects.",
  alternates: {
    canonical: "https://engineeros-delta.vercel.app",
  },
  openGraph: {
    title: "EngineerOS — learn system design & AI engineering",
    description:
      "Lessons on system design and AI engineering, a live knowledge map, and an MCP server for your agents.",
    type: "website",
    siteName: "EngineerOS",
    locale: "en_US",
    url: "https://engineeros-delta.vercel.app",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "EngineerOS — learn system design and AI engineering",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "EngineerOS — learn system design & AI engineering",
    description:
      "Lessons on system design and AI engineering, a live knowledge map, and an MCP server for your agents.",
    images: ["/og-image.png"],
  },
};

function buildBootLines(): BootLine[] {
  const target = "harness-engineering";
  const path = pathTo(target);
  const hits = searchTopics("prompt injection", { limit: 1 });
  const ready = readyToLearn(["llm-fundamentals"]).map((t) => t.id);
  return [
    {
      cmd: `connect ${SITE_URL.replace("https://", "")}/api/mcp`,
      out: `${listToolSummaries().length} tools · read-only · no auth`,
      tone: "ok",
    },
    {
      cmd: `learning_path target=${target}`,
      out: `${path.length} topics · ~${totalMinutes(path.map((t) => t.id))} min · starts at ${path[0]?.id}`,
      tone: "signal",
    },
    {
      cmd: `search_topics "prompt injection"`,
      out: hits[0] ? `1. ${hits[0].id} · score ${hits[0].score}` : "no results",
      tone: "ok",
    },
    {
      cmd: "next_topics completed=[llm-fundamentals]",
      out: `ready: ${ready.slice(0, 3).join(", ")}`,
      tone: "signal",
    },
  ];
}

export default function LandingPage() {
  const BASE = "https://engineeros-delta.vercel.app";
  const graph = buildGraph();
  const hours = Math.round((ALL_TOPICS.reduce((s, t) => s + t.minutes, 0) / 60) * 10) / 10;
  const stats = [
    { value: String(ALL_TOPICS.length), label: `Lessons in ${TRACKS.length} tracks` },
    { value: String(graph.edges.length), label: "Prerequisite links" },
    { value: `~${hours} h`, label: "Of focused material" },
    { value: String(listToolSummaries().length), label: "MCP tools for your bots" },
  ];
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
              "System design and AI engineering lessons",
              "Interactive prerequisite knowledge map",
              "Public read-only MCP server and REST API",
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "HowTo",
            name: "How to set up EngineerOS",
            description: "Set up EngineerOS in 3 steps — create a Supabase project, connect it to EngineerOS, and start taking notes with semantic search.",
            totalTime: "PT15M",
            step: [
              {
                "@type": "HowToStep",
                name: "Create a Supabase project",
                text: "Sign up for a free Supabase account and create a new project. Enable the pgvector extension in your database.",
                url: "https://supabase.com",
              },
              {
                "@type": "HowToStep",
                name: "Connect to EngineerOS",
                text: "Create a free EngineerOS account and enter your Supabase project URL and anon key in the settings.",
                url: `${BASE}/register`,
              },
              {
                "@type": "HowToStep",
                name: "Start taking notes",
                text: "Create your first note, task, or daily entry. EngineerOS automatically indexes everything for semantic search and builds your knowledge graph.",
              },
            ],
          }),
        }}
      />
      <div className="min-h-screen bg-base text-foreground">
        <MarketingNav />
        <main>
          <LandingHero lines={buildBootLines()} />
          <LandingMetrics stats={stats} />
          <LandingTracks />
          <LandingCourse />
          <LandingMap />
          <LandingAgents />
          <LandingProof />
          <LandingFeatures />
          <LandingOffer />
          <LandingComparison />
          <LandingFaq />
          <LandingCta />
        </main>
        <MarketingFooter />
      </div>
    </>
  );
}
