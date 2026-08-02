"use client";

import {
  CalendarDays,
  CheckSquare,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Search,
  Terminal,
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

export function LandingShowcase() {
  return (
    <section id="product" className="relative overflow-hidden py-16 md:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 mx-auto h-[360px] w-[800px] -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(79,70,229,0.16),rgba(30,64,175,0.10)_55%,transparent_75%)] blur-3xl"
      />
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-[11px] tracking-widest text-accent uppercase">
            The board
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            One workspace. Zero context switching.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-secondary">
            Every project, task, note, and daily entry lives in the same place.
            Drag a card, type a note, search across it all, and never re-open a
            tab to remember what you were doing.
          </p>
        </Reveal>

        <Reveal delay={0.12} className="mt-10 md:mt-14">
          <div className="overflow-hidden rounded-xl border border-default bg-elevated shadow-[0_24px_80px_-24px_rgba(0,0,0,0.6)]">
            <div className="flex items-center gap-2 border-b border-border-subtle bg-surface/60 px-4 py-2.5">
              <span className="flex gap-1.5">
                <span className="size-2.5 rounded-full bg-danger/70" />
                <span className="size-2.5 rounded-full bg-warning/70" />
                <span className="size-2.5 rounded-full bg-success/70" />
              </span>
              <span className="mx-auto rounded-md border border-border-subtle bg-base px-3 py-1 font-mono text-[10px] text-faint">
                engineeros.app/tasks
              </span>
              <span className="w-10" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[148px_1fr]">
              <div className="hidden flex-col border-r border-border-subtle bg-surface/40 p-3 sm:flex">
                <div className="mb-4 flex items-center gap-1.5 px-1">
                  <span className="flex size-4 items-center justify-center rounded bg-gradient-to-br from-[#4f46e5] to-[#1e40af]">
                    <Terminal className="size-2.5 text-white" strokeWidth={2} />
                  </span>
                  <span className="text-[10px] font-semibold text-foreground">EngineerOS</span>
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
                    className={
                      "mb-0.5 flex items-center gap-1.5 rounded px-1.5 py-1 text-[10px] " +
                      (active ? "bg-surface-hover font-medium text-foreground" : "text-faint")
                    }
                  >
                    <Icon className="size-3" strokeWidth={1.75} />
                    {label}
                  </span>
                ))}
              </div>

              <div className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-foreground">Tasks</p>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 rounded border border-border-subtle bg-base px-2 py-1 font-mono text-[9px] text-faint">
                      PROJECT: ALL
                    </span>
                    <span className="flex items-center gap-1 rounded border border-border-subtle bg-base px-2 py-1 font-mono text-[9px] text-faint">
                      <Search className="size-2.5" strokeWidth={1.75} />
                      ⌘K
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                  {COLUMNS.map((col) => (
                    <div
                      key={col.label}
                      className="rounded-lg border border-border-subtle bg-base p-2"
                    >
                      <p className="mb-1.5 flex items-center gap-1.5 text-[8px] font-semibold tracking-wide text-faint uppercase">
                        {col.label}
                        <span className="rounded bg-surface-hover px-1 text-[7px] font-medium">
                          {col.count}
                        </span>
                      </p>
                      <div className="space-y-1.5">
                        {col.tasks.map((t) => (
                          <div
                            key={t.title}
                            className="rounded-md border border-border-subtle bg-surface p-2"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className={cn("h-3 w-0.5 shrink-0 rounded-full", t.priority)} />
                              <p className="truncate text-[9px] leading-tight text-foreground">
                                {t.title}
                              </p>
                            </div>
                            {t.tag ? (
                              <span className="mt-1.5 inline-block rounded bg-accent-muted px-1 py-0.5 text-[7px] font-medium text-accent">
                                {t.tag}
                              </span>
                            ) : null}
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
