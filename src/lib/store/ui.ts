import { create } from "zustand";

import {
  readActiveWorkspaceFromBrowser,
  writeActiveWorkspaceToBrowser,
} from "@/lib/workspace/active";

export const SIDEBAR_COLLAPSED_KEY = "engineeros-sidebar-collapsed";
export const ADVANCED_TOOLS_KEY = "engineeros-advanced-tools";

interface UiState {
  /**
   * The workspace every screen and API call is acting on.
   *
   * In the store rather than local component state because the switcher lives in
   * the sidebar while consumers are ~26 screens deep: a useState would give each
   * of them their own copy, so switching workspaces would update the sidebar and
   * nothing else. The cookie is the persisted truth the server reads; this is the
   * reactive mirror of it.
   */
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string) => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  quickCaptureOpen: boolean;
  setQuickCaptureOpen: (open: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  focusMode: boolean;
  toggleFocusMode: () => void;
  notificationPanelOpen: boolean;
  setNotificationPanelOpen: (open: boolean) => void;
  /**
   * Whether the advanced/engineer-oriented tools appear in the sidebar.
   *
   * Progressive disclosure, not removal: the tools stay reachable by everyone,
   * and ⌘K still finds them either way. Default-off is what makes the app legible
   * to a new non-engineer; one click makes it a power-user tool again.
   */
  advancedToolsOpen: boolean;
  toggleAdvancedTools: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  // Seeded from the cookie at store creation. This cannot wait for a mount
  // effect: useWorkspaces resolves the active workspace on its first render, and
  // a null here would make it fall back to the *first* workspace and then write
  // that back over the user's actual choice — silently switching them workspaces.
  // On the server `document` doesn't exist, so the getter returns null and the
  // client's own import re-seeds it.
  activeWorkspaceId: readActiveWorkspaceFromBrowser(),
  setActiveWorkspaceId: (id) => {
    // Write the cookie first: API routes read it, and they read it on the very
    // next request the UI makes.
    writeActiveWorkspaceToBrowser(id);
    set({ activeWorkspaceId: id });
  },
  commandPaletteOpen: false,
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  quickCaptureOpen: false,
  setQuickCaptureOpen: (quickCaptureOpen) => set({ quickCaptureOpen }),
  sidebarCollapsed: false,
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  toggleSidebar: () =>
    set((s) => {
      const next = !s.sidebarCollapsed;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // localStorage unavailable — state still applies for this session.
      }
      return { sidebarCollapsed: next };
    }),
  focusMode: false,
  toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),
  notificationPanelOpen: false,
  setNotificationPanelOpen: (notificationPanelOpen) => set({ notificationPanelOpen }),
  advancedToolsOpen: false,
  toggleAdvancedTools: () =>
    set((s) => {
      const next = !s.advancedToolsOpen;
      try {
        window.localStorage.setItem(ADVANCED_TOOLS_KEY, next ? "1" : "0");
      } catch {
        // localStorage unavailable — the setting still applies for this session.
      }
      return { advancedToolsOpen: next };
    }),
}));

export function getStoredSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Seed the store from the cookie once, on mount.
 *
 * Called from the shell rather than at module scope: reading `document.cookie`
 * during import would run on the server during SSR, where it doesn't exist.
 */
export function hydrateActiveWorkspace(): void {
  const id = readActiveWorkspaceFromBrowser();
  if (id) useUiStore.setState({ activeWorkspaceId: id });
}

/**
 * Whether to reveal advanced tools. Defaults to off for a signed-in stranger and
 * is remembered per browser once they change it.
 *
 * `hasSeenApp` decides the default: someone who has completed onboarding has
 * already met every tool, so hiding them again would be actively annoying. A
 * brand-new workspace gets the short list.
 */
export function getStoredAdvancedTools(hasSeenApp: boolean): boolean {
  try {
    const stored = window.localStorage.getItem(ADVANCED_TOOLS_KEY);
    if (stored !== null) return stored === "1";
  } catch {
    // localStorage unavailable — fall back to the heuristic below.
  }
  return hasSeenApp;
}
