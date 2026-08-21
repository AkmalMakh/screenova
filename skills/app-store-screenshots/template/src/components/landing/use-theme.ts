"use client";
import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "screenova-theme";

/**
 * Drives the landing's light/dark toggle. Toggles the `screenova-dark` class
 * on <body>, which activates every `dark:` Tailwind utility inside the
 * landing wrapper (see the `darkMode` selector in tailwind.config.ts) and
 * swaps the CSS custom properties consumed by theme.ts. Persists the explicit
 * user choice; defaults to dark on first visit.
 *
 * The stored preference is read in an effect rather than initial state so the
 * server render and first client render agree (always dark) and hydration
 * never warns. The layout's inline script applies the same class before paint.
 */
export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "light" || stored === "dark") setThemeState(stored);
    } catch {
      // localStorage unavailable (privacy mode, etc.) — keep the dark default.
    }
  }, []);

  useEffect(() => {
    document.body.classList.toggle("screenova-dark", theme === "dark");
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Ignore — non-persistent is fine, the toggle still works this session.
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  return { theme, toggleTheme };
}
