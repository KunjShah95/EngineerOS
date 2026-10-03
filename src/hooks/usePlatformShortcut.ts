"use client";

import { useSyncExternalStore } from "react";

import { formatCombo, modKey, shiftKey } from "@/lib/platform";

/**
 * Platform-dependent values can't be computed during render without risking a
 * hydration mismatch (server has no `navigator`), and setState-in-effect trips
 * the react-hooks lint rules. `useSyncExternalStore` is the sanctioned shape:
 * the server snapshot uses the non-Apple default, then the client re-renders
 * with its own value after hydration. The platform never changes during a
 * session, so the store never emits and the subscribe is a no-op.
 */
const subscribeNoop = () => () => {};

/** "⌘" on Apple platforms, "Ctrl" elsewhere. */
export function useModKey(): string {
  const snapshot = () => modKey();
  return useSyncExternalStore(subscribeNoop, snapshot, snapshot);
}

/** "⇧" on Apple platforms, "Shift" elsewhere. */
export function useShiftKey(): string {
  const snapshot = () => shiftKey();
  return useSyncExternalStore(subscribeNoop, snapshot, snapshot);
}

/** Formatted combo, e.g. useModCombo("K") → "⌘K" / "Ctrl+K". */
export function useModCombo(...parts: string[]): string {
  const snapshot = () => formatCombo("mod", ...parts);
  return useSyncExternalStore(subscribeNoop, snapshot, snapshot);
}
