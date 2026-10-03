"use client";

import { useSyncExternalStore } from "react";

/** Tracks `prefers-reduced-motion: reduce` for Framer Motion gating. */
const QUERY = "(prefers-reduced-motion: reduce)";
let cached: MediaQueryList | null = null;

function mediaQuery(): MediaQueryList {
  if (!cached) cached = window.matchMedia(QUERY);
  return cached;
}

function subscribe(onChange: () => void): () => void {
  const mq = mediaQuery();
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => mediaQuery().matches,
    () => false
  );
}
