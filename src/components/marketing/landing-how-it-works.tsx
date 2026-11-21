import { ArrowRight, CheckSquare, Link2 } from "lucide-react";

import {
  SectionIntro,
  SectionShell,
} from "@/components/marketing/landing-primitives";

const STEPS = [
  {
    title: "Capture",
    body: "⌘K opens one dialog. Write a note, add a task, or drop it in the inbox for later. Keyword rules file it under the right project.",
    artifact: (
      <span className="flex items-center gap-1">
        <kbd className="flex h-6 min-w-6 items-center justify-center rounded border border-border-default bg-elevated px-1.5 font-mono text-[10px] text-secondary">
          ⌘
        </kbd>
        <kbd className="flex h-6 min-w-6 items-center justify-center rounded border border-border-default bg-elevated px-1.5 font-mono text-[10px] text-secondary">
          K
        </kbd>
        <span className="ml-2 text-[11px] text-tertiary">one dialog</span>
      </span>
    ),
  },
  {
    title: "Connect",
    body: "Type [[ADR-0004]] and the link resolves both ways. Tasks attach to projects; decisions cite the note they came from. The graph is a byproduct, not a chore.",
    artifact: (
      <span className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded border border-border-subtle bg-elevated px-2 py-1 font-mono text-[10px] text-secondary">
          <Link2 className="size-3 text-faint" strokeWidth={1.75} />
          [[ADR-0004]]
        </span>
        <span className="text-[11px] text-tertiary">resolves both ways</span>
      </span>
    ),
  },
  {
    title: "Ask & act",
    body: "Ask in plain English. Every answer cites its sources, and the follow-up task can be created from the answer without retyping it.",
    artifact: (
      <span className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded border border-border-subtle bg-elevated px-1.5 py-1 font-mono text-[10px] text-signal">
          [1]
        </span>
        <ArrowRight className="size-3 text-faint" strokeWidth={1.75} />
        <span className="inline-flex items-center gap-1 rounded border border-border-subtle bg-elevated px-1.5 py-1 text-[10px] text-secondary">
          <CheckSquare className="size-3" strokeWidth={1.75} />
          task
        </span>
        <span className="text-[11px] text-tertiary">without retyping</span>
      </span>
    ),
  },
];

export function LandingHowItWorks() {
  return (
    <SectionShell id="how" bordered className="bg-surface/30">
      <SectionIntro
        title="Three moves. Then it compounds."
        body="There is no template to pick and no schema to design. Capture, link, ask — the structure accumulates on its own."
      />

      <div className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
        {STEPS.map((step) => (
          <div
            key={step.title}
            className="border-t border-border-default pt-5"
          >
            <div className="flex h-7 items-center">{step.artifact}</div>
            <h3 className="mt-5 text-[17px] font-semibold tracking-[-0.01em] text-foreground">
              {step.title}
            </h3>
            <p className="mt-2 max-w-[38ch] text-[14px] leading-relaxed text-secondary">
              {step.body}
            </p>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}
