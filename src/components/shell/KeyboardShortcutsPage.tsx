"use client";

import { Keyboard } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";

const SECTIONS = [
  {
    label: "Global",
    shortcuts: [
      { keys: ["⌘", "K"], desc: "Open command palette / search" },
      { keys: ["⌘", "⇧", "C"], desc: "Quick capture" },
      { keys: ["?"], desc: "Open keyboard shortcuts" },
      { keys: ["Esc"], desc: "Close panel / modal" },
    ],
  },
  {
    label: "Tasks",
    shortcuts: [
      { keys: ["N"], desc: "New task (when on Tasks page)" },
      { keys: ["Esc"], desc: "Close task detail panel" },
      { keys: ["Enter"], desc: "Open focused task" },
    ],
  },
  {
    label: "Notes",
    shortcuts: [
      { keys: ["⌘", "S"], desc: "Save note (auto-saves on blur)" },
      { keys: ["⌘", "⇧", "P"], desc: "Toggle preview / edit mode" },
      { keys: ["⌘", "⇧", "D"], desc: "Download note as .md" },
    ],
  },
  {
    label: "Navigation",
    shortcuts: [
      { keys: ["G", "D"], desc: "Go to Dashboard" },
      { keys: ["G", "T"], desc: "Go to Tasks" },
      { keys: ["G", "N"], desc: "Go to Notes" },
      { keys: ["G", "C"], desc: "Go to Calendar" },
      { keys: ["G", "P"], desc: "Go to Projects" },
    ],
  },
  {
    label: "Calendar",
    shortcuts: [
      { keys: ["←"], desc: "Previous week / month" },
      { keys: ["→"], desc: "Next week / month" },
      { keys: ["T"], desc: "Jump to today" },
    ],
  },
  {
    label: "Pomodoro",
    shortcuts: [
      { keys: ["Space"], desc: "Start / pause timer" },
      { keys: ["R"], desc: "Reset timer" },
    ],
  },
];

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex min-w-[1.5rem] items-center justify-center rounded border border-border-subtle bg-surface px-1.5 py-0.5 font-mono text-[11px] font-medium text-secondary shadow-sm">
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-6">
      <PageHeader
        icon={Keyboard}
        title="Keyboard Shortcuts"
        description="Speed up your workflow with these shortcuts."
        className="mb-8"
      />
      <div className="space-y-8">
        {SECTIONS.map((section) => (
          <section key={section.label}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-secondary">
              {section.label}
            </h2>
            <div className="overflow-hidden rounded-xl border border-default">
              {section.shortcuts.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between border-b border-border-subtle bg-surface px-4 py-3 last:border-0"
                >
                  <span className="text-sm">{s.desc}</span>
                  <div className="flex items-center gap-1">
                    {s.keys.map((k, j) => (
                      <Kbd key={j}>{k}</Kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
