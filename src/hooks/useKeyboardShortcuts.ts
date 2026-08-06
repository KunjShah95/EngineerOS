"use client";

import { useEffect } from "react";

export interface ShortcutDef {
  /** Unique id, used as React key in the shortcuts dialog. */
  id: string;
  /** Grouping shown in the shortcuts dialog, e.g. "Actions". */
  group: string;
  /** Human-readable action name, e.g. "New note". */
  label: string;
  /** Display combo for the help dialog, e.g. "⌘N" or "⇧⌘N". */
  combo: string;
  /** What the shortcut does, shown in the help dialog. */
  description?: string;
  /** The KeyboardEvent.key to match (case-insensitive). */
  key: string;
  /** Require the meta (⌘) / ctrl modifier. */
  mod?: boolean;
  /** Require Shift. */
  shift?: boolean;
  /** Require Alt / Option. */
  alt?: boolean;
  /** Run when the shortcut fires. */
  handler: () => void;
  /**
   * Allow the shortcut to fire while focus is inside an input, textarea,
   * select, or contenteditable. Defaults to false — typing is sacred.
   */
  allowInInput?: boolean;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

/**
 * Registers a set of global keyboard shortcuts on window. Handlers are read
 * fresh on every render (the effect re-subscribes), so closures always see the
 * latest state without stale captures.
 */
export function useKeyboardShortcuts(shortcuts: ShortcutDef[]) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        if (e.key.toLowerCase() !== shortcut.key.toLowerCase()) continue;
        if (shortcut.mod !== undefined && shortcut.mod !== (e.metaKey || e.ctrlKey)) continue;
        if (shortcut.shift !== undefined && shortcut.shift !== e.shiftKey) continue;
        if (shortcut.alt !== undefined && shortcut.alt !== e.altKey) continue;
        if (!shortcut.allowInInput && isEditableTarget(e.target)) continue;
        e.preventDefault();
        shortcut.handler();
        return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });
}
