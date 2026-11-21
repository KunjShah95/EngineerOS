"use client";

import { useState } from "react";

import { LANDING_FAQS } from "@/components/marketing/faq-data";
import {
  ArrowLink,
  SectionShell,
} from "@/components/marketing/landing-primitives";
import { cn } from "@/lib/utils";

export function LandingFaq() {
  return (
    <SectionShell id="faq">
      <div className="grid gap-10 md:grid-cols-[300px_minmax(0,1fr)] md:gap-16">
        <div>
          <h2 className="text-balance text-[clamp(1.9rem,3.6vw,2.75rem)] font-semibold leading-[1.06] tracking-[-0.03em] text-foreground">
            Questions, answered.
          </h2>
          <p className="mt-4 max-w-[34ch] text-[14px] leading-relaxed text-secondary">
            If the answer is not here, the guide and the comparison pages go
            deeper.
          </p>
          <div className="mt-6 flex flex-col items-start gap-2.5">
            <ArrowLink href="/guides/building-a-second-brain">
              Second brain guide
            </ArrowLink>
            <ArrowLink href="/compare/notion-vs-engineeros">
              Notion comparison
            </ArrowLink>
            <ArrowLink href="/compare/obsidian-vs-engineeros">
              Obsidian comparison
            </ArrowLink>
          </div>
        </div>

        <div className="border-t border-border-subtle">
          {LANDING_FAQS.map((faq, index) => (
            <FaqItem
              key={faq.q}
              index={index}
              question={faq.q}
              answer={faq.a}
              defaultOpen={index === 0}
            />
          ))}
        </div>
      </div>
    </SectionShell>
  );
}

function FaqItem({
  index,
  question,
  answer,
  defaultOpen,
}: {
  index: number;
  question: string;
  answer: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const questionId = `faq-question-${index}`;
  const answerId = `faq-answer-${index}`;

  return (
    <div className="border-b border-border-subtle">
      <h3>
        <button
          type="button"
          id={questionId}
          aria-expanded={open}
          aria-controls={answerId}
          onClick={() => setOpen((value) => !value)}
          className="group flex w-full items-start justify-between gap-6 py-[18px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <span className="text-[15px] font-medium leading-snug text-foreground transition-colors group-hover:text-accent">
            {question}
          </span>
          <span
            aria-hidden
            className="relative mt-1 flex size-4 shrink-0 items-center justify-center text-tertiary"
          >
            <span className="absolute h-px w-3 bg-current" />
            <span
              className={cn(
                "absolute h-3 w-px bg-current transition-transform duration-200 ease-out",
                open ? "rotate-90" : "rotate-0"
              )}
            />
          </span>
        </button>
      </h3>

      <div
        id={answerId}
        role="region"
        aria-labelledby={questionId}
        aria-hidden={!open}
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <p className="max-w-[68ch] pb-5 pr-8 text-[14px] leading-relaxed text-secondary">
            {answer}
          </p>
        </div>
      </div>
    </div>
  );
}
