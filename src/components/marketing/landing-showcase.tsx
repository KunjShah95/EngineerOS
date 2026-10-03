"use client";

import {
  CalendarDays,
  CheckSquare,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Search,
} from "lucide-react";

import { Reveal } from "@/components/marketing/reveal";
import { cn } from "@/lib/utils";

const COLUMNS = [
  {
    label: "Backlog",
    count: 2,
    tasks: [
      { title: "Add keyboard shortcuts", priority: "bg-faint", tag: "MVP" },
      { title: "Voice notes (later)", priority: "bg-faint", tag: null },
    ],
  },
  {
    label: "Todo",
    count: 2,
    tasks: [
      { title: "Weekly review template", priority: "bg-info", tag: "Daily" },
      { title: "Search result ranking", priority: "bg-warning", tag: null },
    ],
  },
  {
    label: "In Progress",
    count: 1,
    tasks: [
      { title: "Kanban drag and drop", priority: "bg-warning", tag: "Board" },
    ],
  },
  {
    label: "Done",
    count: 3,
    tasks: [
      { title: "Auth with Supabase", priority: "bg-success", tag: null },
      { title: "Daily note auto-create", priority: "bg-success", tag: null },
      { title: "Design tokens", priority: "bg-success", tag: "Design" },
    ],
  },
];

/**
 * The board, shown as the product actually renders it: hairline chrome, a
 * labelled bar instead of three decorative macOS dots, mono group labels, and
 * rail-marked selection. A mock that doesn't match the real UI is worse than no
 * mock — it sells something you don't ship.
 */
export function LandingShowcase() {
  return (
    <section id="product" className="relative py-16 md:py-28">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-2xl">
          <p className="label-mono">the board</p>
          <h2 className="mt-5 font-serif-display text-[clamp(1.9rem,4vw,2.75rem)] font-normal leading-[1.06] tracking-[-0.02em] text-foreground">
            One workspace. Zero context switching.
          </h2>
          <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-secondary">
            Every project, task, note, and daily entry lives in the same place.
            Drag a card, type a note, search across it all, and never re-open a
            tab to remember what you were doing.
          </p>
        </Reveal>

        <Reveal delay={0.12} className="mt-10 md:mt-14">
          <div className="overflow-hidden rounded-lg border border-default bg-elevated shadow-[0_28px_70px_-40px_rgba(0,0,0,0.9)]">
            {/* Chrome is labelled, not mimicked. */}
            <div className="flex items-center gap-3 border-b border-border-subtle bg-surface/60 px-4 py-2.5">
              <span className="label-mono">engineeros / tasks</span>
              <span className="figure-mono ml-auto flex items-center gap-1 border border-border-subtle bg-base px-2 py-0.5 text-[10px] text-faint">
                <Search className="size-2.5" strokeWidth={1.75} />
                ⌘K
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[148px_1fr]">
              <div className="hidden flex-col border-r border-border-subtle bg-surface/40 p-3 sm:flex">
                <div className="mb-4 flex items-center gap-1.5 px-1">
                  <span className="figure-mono flex size-4 items-center justify-center rounded-sm border border-border-subtle text-[8px] text-signal">
                    <span aria-hidden>&gt;_</span>
                  </span>
                  <span className="text-[10px] font-medium text-foreground">EngineerOS</span>
                </div>
                {[
                  { icon: LayoutDashboard, label: "Dashboard" },
                  { icon: FolderKanban, label: "Projects" },
                  { icon: CheckSquare, label: "Tasks", active: true },
                  { icon: FileText, label: "Notes" },
                  { icon: CalendarDays, label: "Daily" },
                ].map(({ icon: Icon, label, active }) => (
                  <span
                    key={label}
                    className={cn(
                      "relative mb-0.5 flex items-center gap-1.5 rounded-sm py-1 pr-1.5 pl-2.5 text-[10px]",
                      active ? "bg-surface-hover text-foreground" : "text-faint"
                    )}
                  >
                    {/* Rail marks selection — the real pattern, not a filled pill. */}
                    {active && (
                      <span
                        aria-hidden
                        className="absolute inset-y-0 left-0 w-0.5 bg-accent"
                      />
                    )}
                    <Icon className="size-3" strokeWidth={1.75} />
                    {label}
                  </span>
                ))}
              </div>

              <div className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="label-mono">tasks</span>
                  <span className="label-mono border border-border-subtle bg-base px-1.5 py-0.5 text-[9px]">
                    project: all
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                  {COLUMNS.map((col) => (
                    <div key={col.label} className="rounded-md border border-border-subtle bg-base p-2">
                      <p className="mb-1.5 flex items-center gap-1.5">
                        <span className="label-mono text-[8px]">{col.label}</span>
                        <span className="figure-mono ml-auto text-[9px] text-faint">
                          {String(col.count).padStart(2, "0")}
                        </span>
                      </p>
                      <div className="space-y-1.5">
                        {col.tasks.map((t) => (
                          <div
                            key={t.title}
                            className="flex items-start gap-1.5 rounded-sm border border-border-subtle bg-surface p-1.5"
                          >
                            <span className={cn("mt-0.5 h-3 w-0.5 shrink-0", t.priority)} />
                            <p className="min-w-0 flex-1 text-[9px] leading-tight text-foreground">
                              {t.title}
                              {t.tag ? (
                                <span className="label-mono mt-1 block text-[7px]">{t.tag}</span>
                              ) : null}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
