"use client";

import { Check, X } from "lucide-react";

import { Reveal } from "@/components/marketing/reveal";

const FEATURES = [
  {
    label: "Semantic search",
    engineeros: true,
    notion: true,
    obsidian: false,
    evernote: false,
  },
  {
    label: "AI assistant with citations",
    engineeros: true,
    notion: false,
    obsidian: false,
    evernote: false,
  },
  {
    label: "Knowledge graph",
    engineeros: true,
    notion: false,
    obsidian: true,
    evernote: false,
  },
  {
    label: "Self-hosted data",
    engineeros: true,
    notion: false,
    obsidian: true,
    evernote: false,
  },
  {
    label: "No vendor lock-in",
    engineeros: true,
    notion: false,
    obsidian: true,
    evernote: false,
  },
  {
    label: "Kanban boards",
    engineeros: true,
    notion: true,
    obsidian: false,
    evernote: false,
  },
  {
    label: "Daily notes",
    engineeros: true,
    notion: false,
    obsidian: false,
    evernote: false,
  },
  {
    label: "Automation rules",
    engineeros: true,
    notion: true,
    obsidian: false,
    evernote: false,
  },
  {
    label: "Free to start",
    engineeros: true,
    notion: true,
    obsidian: true,
    evernote: true,
  },
  {
    label: "Open-source core",
    engineeros: true,
    notion: false,
    obsidian: false,
    evernote: false,
  },
];

function CheckIcon({ present }: { present: boolean }) {
  return present ? (
    <Check className="size-4 text-success" strokeWidth={1.75} />
  ) : (
    <X className="size-4 text-faint" strokeWidth={1.75} />
  );
}

export function LandingComparison() {
  return (
    <section id="compare" className="relative overflow-hidden py-16 md:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 mx-auto h-[360px] w-[800px] -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(79,70,229,0.16),rgba(30,64,175,0.10)_55%,transparent_75%)] blur-3xl"
      />
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-[11px] tracking-widest text-accent uppercase">
            Comparison
          </p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            How EngineerOS stacks up
          </h2>
          <p className="mt-4 text-base leading-relaxed text-secondary">
            EngineerOS combines the best of note-taking, project management,
            and AI — without locking your data in a proprietary cloud.
          </p>
        </Reveal>

        <Reveal delay={0.12} className="mt-10 md:mt-14 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="py-3 pr-4 text-left text-xs font-semibold text-faint uppercase tracking-wide">
                  Feature
                </th>
                <th className="py-3 px-4 text-center text-xs font-semibold text-accent uppercase tracking-wide">
                  EngineerOS
                </th>
                <th className="py-3 px-4 text-center text-xs font-semibold text-secondary uppercase tracking-wide">
                  Notion
                </th>
                <th className="py-3 px-4 text-center text-xs font-semibold text-secondary uppercase tracking-wide">
                  Obsidian
                </th>
                <th className="py-3 pl-4 text-center text-xs font-semibold text-secondary uppercase tracking-wide">
                  Evernote
                </th>
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((f) => (
                <tr
                  key={f.label}
                  className="border-b border-border-subtle/50 hover:bg-surface-hover/50"
                >
                  <td className="py-3 pr-4 text-sm text-foreground">
                    {f.label}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <CheckIcon present={f.engineeros} />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <CheckIcon present={f.notion} />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <CheckIcon present={f.obsidian} />
                  </td>
                  <td className="py-3 pl-4 text-center">
                    <CheckIcon present={f.evernote} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
      </div>
    </section>
  );
}