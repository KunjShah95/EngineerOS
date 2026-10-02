/**
 * Platform-aware modifier key helpers.
 *
 * Shortcuts accept meta OR ctrl everywhere; the chrome must show the key the
 * user actually presses so Windows/Linux demos don't teach ⌘.
 */

export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform ?? navigator.platform ?? "";
  return /Mac|iPhone|iPad|iPod/i.test(platform);
}

/** Glyph shown in kbd chrome: ⌘ on Apple, Ctrl elsewhere. */
export function modKey(): string {
  return isApplePlatform() ? "⌘" : "Ctrl";
}

/** Shift glyph: ⇧ on Apple, Shift elsewhere. */
export function shiftKey(): string {
  return isApplePlatform() ? "⇧" : "Shift";
}

/**
 * Format a shortcut combo for display.
 * Accepts tokens like "mod", "shift", letters, or already-resolved glyphs.
 * Example: formatCombo("mod", "K") → "⌘K" or "Ctrl+K"
 */
export function formatCombo(...parts: string[]): string {
  const apple = isApplePlatform();
  const resolved = parts.map((p) => {
    const lower = p.toLowerCase();
    if (lower === "mod" || p === "⌘" || lower === "ctrl" || lower === "cmd") {
      return modKey();
    }
    if (lower === "shift" || p === "⇧") return shiftKey();
    return p;
  });
  return apple ? resolved.join("") : resolved.join("+");
}
