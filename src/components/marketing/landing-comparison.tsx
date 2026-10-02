"use client";

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

function Mark({ present }: { present: boolean }) {
  /* Marked in words, not green ticks. A checkmark grid is the most recognizable
     SaaS-template artifact there is, and it flattens "absent" into a scold. */
  return present ? (
    <span className="label-mono text-signal">yes</span>
  ) : (
    <span className="label-mono text-[10px]">—</span>
  );
}

export function LandingComparison() {
  return (
    <section id="compare" className="relative py-16 md:py-28">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <Reveal className="max-w-2xl">
          <p className="label-mono">comparison</p>
          <h2 className="mt-5 font-serif-display text-[clamp(1.9rem,4vw,2.75rem)] font-normal leading-[1.06] tracking-[-0.02em] text-foreground">
            How EngineerOS stacks up
          </h2>
          <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-secondary">
            EngineerOS combines the best of note-taking, project management,
            and AI — without locking your data in a proprietary cloud.
          </p>
        </Reveal>

        <Reveal delay={0.12} className="mt-10 overflow-x-auto md:mt-14">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border-default">
                <th className="label-mono py-3 pr-4 text-left font-normal">capability</th>
                {/* Our column is the one that gets emphasis — a rail, not a
                    filled cell, so the table stays a table. */}
                <th className="label-mono border-x border-border-subtle bg-surface/40 px-4 py-3 text-center font-normal text-signal">
                  EngineerOS
                </th>
                <th className="label-mono px-4 py-3 text-center font-normal">Notion</th>
                <th className="label-mono px-4 py-3 text-center font-normal">Obsidian</th>
                <th className="label-mono pl-4 py-3 text-center font-normal">Evernote</th>
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((f) => (
                <tr key={f.label} className="border-b border-border-subtle/60">
                  <td className="py-3 pr-4 text-sm text-secondary">{f.label}</td>
                  <td className="rail-signal bg-surface/40 px-4 py-3 text-center">
                    <Mark present={f.engineeros} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Mark present={f.notion} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Mark present={f.obsidian} />
                  </td>
                  <td className="pl-4 py-3 text-center">
                    <Mark present={f.evernote} />
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