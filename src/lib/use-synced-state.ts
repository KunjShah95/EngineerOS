"use client";

import { useState } from "react";

/**
 * useState that re-syncs from a changing source value without an effect,
 * using the React-recommended "adjusting state during render" pattern.
 *
 * Value-equality (`!==`) means edits to the local state are never clobbered by
 * refetches that return identical data — the source only wins when it actually
 * changes (e.g. a note or task loads for the first time, or the entity changes).
 */
export function useSyncedState<T>(
  source: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [prev, setPrev] = useState(source);
  const [state, setState] = useState(source);

  if (source !== prev) {
    setPrev(source);
    setState(source);
  }

  return [state, setState];
}
