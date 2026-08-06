"use client";

import { useMemo } from "react";
import { Command } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ShortcutDef } from "@/hooks/useKeyboardShortcuts";

const GROUP_ORDER = ["Navigate", "Actions", "View"];

export function ShortcutsDialog({
  open,
  onOpenChange,
  shortcuts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcuts: ShortcutDef[];
}) {
  const groups = useMemo(() => {
    const map = new Map<string, ShortcutDef[]>();
    for (const s of shortcuts) {
      const list = map.get(s.group) ?? [];
      list.push(s);
      map.set(s.group, list);
    }
    const ordered = [...map.entries()].sort((a, b) => {
      const ia = GROUP_ORDER.indexOf(a[0]);
      const ib = GROUP_ORDER.indexOf(b[0]);
      if (ia === -1 && ib === -1) return a[0].localeCompare(b[0]);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    return ordered.map(([group, items]) => ({
      group,
      items: items.sort((a, b) => a.combo.localeCompare(b.combo)),
    }));
  }, [shortcuts]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Command className="size-4 text-accent" strokeWidth={1.75} />
            Keyboard shortcuts
          </DialogTitle>
          <DialogDescription>
            Move fast without leaving the keyboard. Press ⌘K anywhere to search or run commands.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
          {groups.map(({ group, items }) => (
            <div key={group}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
                {group}
              </p>
              <div className="space-y-1">
                {items.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-4 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-surface-hover"
                  >
                    <span className="min-w-0 truncate text-secondary">{s.label}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {s.combo.split("+").map((part, i) => (
                        <kbd
                          key={i}
                          className="rounded border border-border-subtle bg-elevated px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground"
                        >
                          {part}
                        </kbd>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
