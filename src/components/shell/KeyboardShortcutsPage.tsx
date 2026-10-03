"use client";

import { useMemo } from "react";
import { Keyboard } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { useModCombo, useModKey, useShiftKey } from "@/hooks/usePlatformShortcut";

function buildSections(mod: string, shift: string) {
  return [
    {
      label: "Global",
      shortcuts: [
        { keys: [mod, "K"], desc: "Open command palette / search" },
        { keys: [mod, "G"], desc: "Quick capture" },
        { keys: [mod, "/"], desc: "Open keyboard shortcuts" },
        { keys: ["Esc"], desc: "Close panel / modal" },
      ],
    },
    {
      label: "Actions",
      shortcuts: [
        { keys: [mod, "N"], desc: "New note" },
        { keys: [shift, mod, "N"], desc: "New task" },
        { keys: [shift, mod, "F"], desc: "Toggle focus mode" },
        { keys: [mod, "B"], desc: "Toggle sidebar" },
      ],
    },
    {
      label: "Navigation",
      shortcuts: [
        { keys: [mod, "1"], desc: "Go to Dashboard" },
        { keys: [mod, "2"], desc: "Go to Projects" },
        { keys: [mod, "3"], desc: "Go to Tasks" },
        { keys: [mod, "4"], desc: "Go to Calendar" },
        { keys: [mod, "5"], desc: "Go to Notes" },
        { keys: [mod, "6"], desc: "Go to Journal" },
        { keys: [mod, "7"], desc: "Go to Assistant" },
        { keys: [mod, "8"], desc: "Go to Settings" },
        { keys: [mod, "9"], desc: "Go to Knowledge Graph" },
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
        { keys: [mod, "S"], desc: "Save note (auto-saves on blur)" },
        { keys: [mod, shift, "P"], desc: "Toggle preview / edit mode" },
        { keys: [mod, shift, "D"], desc: "Download note as .md" },
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
}

function Kbd({ children }: { children: string }) {
  // Mono + tabular so the shortcut column reads as a spec sheet, not as
  // buttons. Hairline border, no shadow — shadows mean "floats".
  return (
    <kbd className="figure-mono inline-flex min-w-[1.5rem] items-center justify-center rounded border border-border-subtle bg-surface px-1.5 py-0.5 text-[11px] text-secondary">
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsPage() {
  const mod = useModKey();
  const shift = useShiftKey();
  const sections = useMemo(() => buildSections(mod, shift), [mod, shift]);
  const searchCombo = useModCombo("K");

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-6">
      <PageHeader
        icon={Keyboard}
        title="Keyboard Shortcuts"
        description={`Speed up your workflow. Press ${searchCombo} anywhere to search.`}
        className="mb-8"
      />
      <div className="space-y-7">
        {sections.map((section) => (
          <section key={section.label}>
            <h2 className="label-mono mb-2">{section.label}</h2>
            <div className="overflow-hidden rounded-lg border border-border-subtle">
              {section.shortcuts.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-4 border-b border-border-subtle px-4 py-2.5 last:border-0"
                >
                  <span className="text-sm text-secondary">{s.desc}</span>
                  <div className="flex shrink-0 items-center gap-1">
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
