"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import { getTopic } from "@/content/learn";

const KEY = "engineeros-learn-progress";
const listeners = new Set<() => void>();

function readRaw(): string {
  try {
    return window.localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function parse(raw: string): Set<string> {
  try {
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    // Drop ids for topics that no longer exist so old progress never breaks the UI.
    return new Set(arr.filter((x): x is string => typeof x === "string" && !!getTopic(x)));
  } catch {
    return new Set();
  }
}

/**
 * Learner progress, stored in this browser only. Server render and first client
 * render both see "nothing completed", so hydration always matches.
 */
export function useProgress() {
  const raw = useSyncExternalStore(subscribe, readRaw, () => "[]");
  const completed = useMemo(() => parse(raw), [raw]);

  const toggle = useCallback((id: string) => {
    const next = parse(readRaw());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    try {
      window.localStorage.setItem(KEY, JSON.stringify([...next]));
    } catch {
      // Storage blocked (private mode): progress simply won't persist.
    }
    listeners.forEach((l) => l());
  }, []);

  return { completed, toggle };
}
