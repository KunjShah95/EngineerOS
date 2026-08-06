"use client";

import { ChevronDown } from "lucide-react";

import { useState } from "react";
import { cn } from "@/lib/utils";

const FAQS = [
  {
    q: "What is EngineerOS?",
    a: "EngineerOS is an AI-native workspace that combines notes, tasks, projects, and daily entries into one connected system. It features semantic search, a knowledge graph, an AI assistant with citations, and automation rules — all running on your own Supabase data.",
  },
  {
    q: "What is an AI-native workspace?",
    a: "An AI-native workspace is a productivity tool built from the ground up with AI as a core feature — not bolted on as an add-on. In EngineerOS, every note, task, and daily entry is automatically indexed for semantic search, and the AI assistant can answer questions about your workspace with citations back to source notes.",
  },
  {
    q: "How does EngineerOS search work?",
    a: "EngineerOS uses semantic search powered by embeddings. Every note, task, and daily entry is automatically indexed, so you can ask questions in plain English and get grounded answers with citations back to the exact source notes.",
  },
  {
    q: "Is EngineerOS free?",
    a: "EngineerOS is free to start. Your data lives in your own Supabase project — no vendor lock-in, no credit card required. See the pricing page for full details on Pro and Enterprise plans.",
  },
  {
    q: "How does the knowledge graph work?",
    a: "EngineerOS automatically builds a knowledge graph from wikilinks in your notes and links between tasks and notes. You can visualize connections, filter by project, and discover hidden relationships across your workspace.",
  },
  {
    q: "Can I automate repetitive tasks?",
    a: "Yes. EngineerOS includes automation rules for recurring tasks, quick captures that auto-triage by keyword, and daily rollover of unfinished work — so your daily rhythm builds itself.",
  },
  {
    q: "Where does my data live?",
    a: "Your data lives in your own Supabase project. EngineerOS connects to it via the Supabase client — no data is stored on EngineerOS servers. You own your data and can export it at any time.",
  },
  {
    q: "What makes EngineerOS different from Notion or Obsidian?",
    a: "EngineerOS combines semantic search, AI-powered citations, and a visual knowledge graph in a single self-hosted workspace. Unlike Notion, your data is not locked in a proprietary cloud. Unlike Obsidian, it includes built-in AI search and automation without requiring plugins.",
  },
  {
    q: "Who is EngineerOS built for?",
    a: "EngineerOS is built for engineers, researchers, and builders who want a single connected system for their notes, tasks, and projects — without vendor lock-in or AI that's disconnected from their actual work.",
  },
  {
    q: "Does EngineerOS work as a second brain?",
    a: "Yes. EngineerOS is designed as a second brain for technical builders — a place where every note, task, and decision is captured, indexed, and connected. Semantic search lets you retrieve knowledge in plain English, and the knowledge graph shows how ideas link across projects.",
  },
];

export function LandingFaq() {
  return (
    <section id="faq" className="relative overflow-hidden py-16 md:py-28">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
        <div className="text-center">
          <p className="font-mono text-[11px] tracking-widest text-accent uppercase">
            FAQ
          </p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Common questions
          </h2>
        </div>

        <div className="mt-10 space-y-3">
          {FAQS.map((faq) => (
            <FaqItem key={faq.q} question={faq.q} answer={faq.a} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqItem({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border-subtle bg-surface">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-foreground">
          {question}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-faint transition-transform duration-200",
            open && "rotate-180"
          )}
          strokeWidth={1.75}
        />
      </button>
      <div
        className={cn(
          "overflow-hidden px-5 text-sm leading-relaxed text-secondary transition-all duration-200",
          open ? "max-h-96 pb-4" : "max-h-0"
        )}
        aria-hidden={!open}
      >
        {answer}
      </div>
    </div>
  );
}