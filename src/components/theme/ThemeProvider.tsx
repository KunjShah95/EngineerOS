"use client";

import { useEffect } from "react";
import { getStoredTheme, THEME_STORAGE_KEY, useThemeStore } from "@/lib/store/theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  useEffect(() => {
    setTheme(getStoredTheme());
  }, [setTheme]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    // Keep the `.dark` class in sync so shadcn `dark:` variants and any
    // library that checks for the class work alongside the data-theme attr.
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore storage errors (private mode / disabled storage)
    }
  }, [theme]);

  return <>{children}</>;
}
