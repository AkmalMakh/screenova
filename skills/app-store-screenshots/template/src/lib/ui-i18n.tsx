"use client";
import * as React from "react";
import type { BuiltInElementId, Device, HeadlineFontFamily, SlideLayout } from "./types";
import { en, type TranslationKey } from "./ui-translations/en";
import { de } from "./ui-translations/de";
import { es } from "./ui-translations/es";
import { fr } from "./ui-translations/fr";

export type UiLang = "en" | "de" | "es" | "fr";

export const UI_STORAGE_KEY = "app-store-screenshots:ui-lang:v1";

export const UI_LANGUAGES: readonly { code: UiLang; name: string }[] = [
  { code: "en", name: "English" },
  { code: "de", name: "Deutsch" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
];

export const DICTIONARIES: Record<UiLang, Record<TranslationKey, string>> = { en, de, es, fr };

export type InterpVars = Record<string, string | number>;

export function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/**
 * Render a dictionary entry: pick the plural form via `|` when a numeric
 * `count` var is present (count === 1 → first form, else second — valid for
 * en/de/es/fr), then substitute {name} placeholders. Unknown placeholders are
 * left intact; unknown keys render as the key itself (defensive).
 */
export function render(
  dict: Record<TranslationKey, string>,
  key: TranslationKey,
  vars?: InterpVars,
): string {
  let text = dict[key];
  if (text === undefined) return key;
  const count = vars?.count;
  if (typeof count === "number" && text.includes("|")) {
    const [one, many] = text.split("|");
    text = (count === 1 ? one : many).trim();
  }
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/** Resolve the UI language: stored choice → browser language → English. */
export function resolveUiLang(stored: string | null, navigatorLanguage: string): UiLang {
  if (stored && stored in DICTIONARIES) return stored as UiLang;
  const prefix = navigatorLanguage.slice(0, 2).toLowerCase();
  if (prefix in DICTIONARIES) return prefix as UiLang;
  return "en";
}

export function detectUiLang(): UiLang {
  if (typeof window === "undefined") return "en";
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(UI_STORAGE_KEY);
  } catch {
    // Privacy mode etc. — fall through to browser language.
  }
  return resolveUiLang(stored, window.navigator.language || "en");
}

export type T = {
  lang: UiLang;
  setLang: (lang: UiLang) => void;
  t: (key: TranslationKey, vars?: InterpVars) => string;
};

const LanguageContext = React.createContext<T | null>(null);

export function useT(): T {
  const value = React.useContext(LanguageContext);
  if (!value) throw new Error("useT must be used inside LanguageProvider");
  return value;
}

// For shared primitives that also render outside the app shell (marketing
// pages have no LanguageProvider): English there, the chosen language inside.
const englishT: T["t"] = (key, vars) => render(DICTIONARIES.en, key, vars);
export function useMaybeT(): T["t"] {
  return React.useContext(LanguageContext)?.t ?? englishT;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // "en" first so the first client render matches the server HTML.
  const [lang, setLangState] = React.useState<UiLang>("en");

  React.useEffect(() => {
    setLangState(detectUiLang());
  }, []);

  const setLang = React.useCallback((next: UiLang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(UI_STORAGE_KEY, next);
    } catch {
      // Best effort — the in-memory choice still applies for this session.
    }
  }, []);

  React.useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = React.useCallback(
    (key: TranslationKey, vars?: InterpVars) => render(DICTIONARIES[lang], key, vars),
    [lang],
  );

  const value = React.useMemo<T>(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

// ---------- Label-map lookups (keys defined in the en dictionary) ----------

export function deviceLabel(device: Device, t: T["t"]): string {
  return t(`device.${device}`);
}

export function layoutLabel(layout: SlideLayout, t: T["t"]): string {
  return t(`layout.${layout}`);
}

export function layoutHint(layout: SlideLayout, t: T["t"]): string {
  return t(`layoutHint.${layout}`);
}

export function fontLabel(font: HeadlineFontFamily, t: T["t"]): string {
  return t(`font.${font}`);
}

export function elementLabel(id: BuiltInElementId | "text" | "decoration", t: T["t"]): string {
  return t(`element.${id}`);
}
