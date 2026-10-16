"use client";
import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "screenova-theme";

/**
 * Shared, light-first appearance for landing, Studio, and editor. The html
 * class activates semantic tokens and dark utilities without changing deck data.
 *
 * The stored preference is read in an effect rather than initial state so the
 * server render and first client render agree (always light) and hydration
 * never warns. The layout's inline script applies the same class before paint.
 */
export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setThemeState] = useState<Theme>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "light" || stored === "dark") setThemeState(stored);
    } catch {
      // Storage unavailable: keep the light default.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.classList.toggle("screenova-dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Ignore — non-persistent is fine, the toggle still works this session.
    }
  }, [theme, ready]);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  return { theme, toggleTheme };
}
