import { create } from "zustand";

export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "engineeros-theme";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>()((set) => ({
  theme: "dark",
  setTheme: (theme) => set({ theme }),
}));

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}
