import { z } from "zod";
import { DEFAULT_THEME_ID, THEMES } from "./constants";
import type { SlideAnalysis } from "./import-slides";
import type { Theme, ThemeId } from "./types";

// A template deck drafted from a free-text app description. The editor turns
// it into a real project via buildSlidesFromAnalysis (lib/import-slides.ts).

export const DECK_SLIDE_LAYOUTS = [
  "hero",
  "device-bottom",
  "device-top",
  "two-devices",
  "no-device",
] as const;
export type DeckSlideLayout = (typeof DECK_SLIDE_LAYOUTS)[number];

// Layouts allowed when the user attached real screenshots: every slide must
// render its screenshot, so "no-device" (which draws no device) is excluded.
export const DECK_DEVICE_LAYOUTS = ["hero", "device-bottom", "device-top", "two-devices"] as const;

export const DECK_THEME_IDS = [
  "clean-light",
  "dark-bold",
  "warm-editorial",
  "ocean-fresh",
  "bloom-roast",
  "mote-calendar",
] as const;

export type DeckSuggestion = {
  appName: string;
  themeId: ThemeId;
  // AI-proposed color system — sampled from style references when present,
  // derived from the described vibe otherwise. themeId stays as a fallback
  // for when the palette fails validation.
  customTheme?: Theme;
  summary: string;
  slides: SlideAnalysis[];
};

export const MAX_DECK_SLIDES = 8;
export const MIN_DECK_SLIDES = 3;
export const DEFAULT_DECK_COUNT = 5;

// Competitor / inspiration links the user attaches to the studio composer.
// App Store links resolve to real screenshots; anything else rides along as
// a named URL the model may recognize.
export const MAX_STYLE_REFERENCES = 3;
export const MAX_REFERENCE_SCREENSHOTS = 3;

export type StyleReferenceSummary = {
  name: string;
  hasImages: boolean;
};

const slideCopySchema = z.object({
  label: z.string().trim().min(1).max(40),
  headline: z.string().trim().min(1).max(120),
});

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const deckThemeSchema = z.object({
  name: z.string().trim().min(1).max(40),
  bg: z.string().regex(HEX_COLOR),
  bgAlt: z.string().regex(HEX_COLOR),
  fg: z.string().regex(HEX_COLOR),
  fgAlt: z.string().regex(HEX_COLOR),
  accent: z.string().regex(HEX_COLOR),
  muted: z.string().regex(HEX_COLOR),
});

// Structured Outputs requires bounded object keys with
// additionalProperties: false. z.record() emits `propertyNames` (rejected by
// OpenAI), so build a literal-keyed z.object from the REQUEST's locales —
// same trick as the analyze-screenshots route.
export function buildDeckSchema(
  locales: string[],
  count: number,
  layouts: readonly DeckSlideLayout[] = DECK_SLIDE_LAYOUTS,
) {
  const copyByLocale: Record<string, typeof slideCopySchema> = {};
  for (const locale of locales) copyByLocale[locale] = slideCopySchema;
  return z.object({
    appName: z.string().trim().min(1).max(40),
    themeId: z.enum(DECK_THEME_IDS),
    theme: deckThemeSchema,
    summary: z.string().trim().min(1).max(500),
    slides: z
      .array(
        z.object({
          layout: z.enum(layouts),
          copy: z.object(copyByLocale),
        }),
      )
      .length(count),
  });
}

export function buildDeckPrompt(
  locales: string[],
  device: string,
  count: number,
  screenshotCount = 0,
  styleReferences: StyleReferenceSummary[] = [],
): string {
  const themeGuide = DECK_THEME_IDS.map((id) => `- ${id}: ${THEMES[id].name}`).join("\n");
  const slideRules =
    screenshotCount > 0
      ? `The user attached ${screenshotCount} screenshots of their app. Write exactly one slide per screenshot, in the same order — the first slide is about screenshot 1, and so on. Ground each label and headline in what that screenshot actually shows; never invent features the screenshots don't display. Every slide must use a layout that shows a device frame (hero, device-bottom, device-top, two-devices) — never "no-device". Vary the layouts for rhythm.`
      : `Vary the layouts across screens for visual rhythm; the first screen is a "hero" and the last is a "no-device" closer. Use at most one "two-devices" screen.`;
  const referenceRules = styleReferences.length
    ? `\n\nSTYLE REFERENCES
The user attached ${styleReferences.length} reference app${styleReferences.length === 1 ? "" : "s"} whose App Store presence they want to emulate:
${styleReferences
  .map(
    (reference, index) =>
      `${index + 1}. ${reference.name}${reference.hasImages ? " — its store screenshots are attached below, labeled STYLE REFERENCE" : " — no screenshots available; go by what you know of this product"}`,
  )
  .join("\n")}
Study the references for DIRECTION only: layout rhythm, copy tone and energy, how they sequence features, and which theme fits that vibe. Then apply that direction to the USER'S app. Never copy a reference's headlines, feature claims, prices, or brand names — every word of copy must describe the user's app as they described it.`
    : "";
  return `You are the template engine inside an App Store screenshot editor. The user has described their app and wants a starter template deck to begin designing from.${referenceRules}

Draft exactly ${count} screens for a ${device}-frame App Store campaign:
- ${slideRules}
- label: a short feature keyword (≤40 characters). It renders as a small uppercase accent line.
- headline: punchy, outcome-led copy (≤120 characters). It renders as the main text. Keep it readable at thumbnail size.
- Never invent features, testimonials, prices, or facts beyond what the user described. If the description is thin, propose plausible, on-brand framing rather than specifics.
- For every screen, write label and headline in EACH of the project's languages: ${locales.join(", ")}. The response's copy object must contain an entry for every one of these locale codes, with no extra codes.

Also return:
- appName: the app's name as stated by the user, or a short clean name you propose (≤40 characters).
- theme: a custom color system for the campaign backgrounds (NOT the app UI). All six values are 6-digit hex:
  - bg: the primary background behind most screens
  - bgAlt: a contrasting secondary background for 1–2 emphasis screens
  - fg / fgAlt: headline text on bg / on bgAlt — contrast must be strong (≥4.5:1)
  - accent: the small uppercase label color and highlight color (must be readable on bg)
  - muted: subdued secondary text on bg
  ${
    styleReferences.length
      ? "Sample this palette FROM THE STYLE REFERENCE screenshots: match their dominant background color, their accent, their light-or-dark mood — the finished deck should sit naturally next to the references on the App Store. Do not fall back to a generic palette when references are attached."
      : "Derive the palette from the described vibe. Commit to a point of view — a real brand color story, not default white with black text."
  }
  Also give the palette a short name (≤40 characters) describing its mood.
- themeId: the built-in theme closest to your custom palette, as a fallback, from:
${themeGuide}
  Choose by color similarity to YOUR palette — never pick a theme just because its name resembles the app.
- summary: one or two friendly sentences (≤500 characters) telling the user what template you drafted — the slide order, the vibe, and where the colors came from.`;
}

/** Validate and normalize a model response into a DeckSuggestion. */
export function normalizeDeck(
  value: unknown,
  locales: string[],
  count: number,
): DeckSuggestion | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.slides) || raw.slides.length !== count) return null;

  const slides: SlideAnalysis[] = [];
  for (const item of raw.slides) {
    if (!item || typeof item !== "object") return null;
    const entry = item as Record<string, unknown>;
    if (
      typeof entry.layout !== "string" ||
      !(DECK_SLIDE_LAYOUTS as readonly string[]).includes(entry.layout)
    ) {
      return null;
    }
    const copy = entry.copy as Record<string, unknown> | null;
    if (!copy || typeof copy !== "object") return null;
    const localized: SlideAnalysis["copy"] = {};
    for (const locale of locales) {
      const pair = copy[locale] as Record<string, unknown> | null;
      if (!pair || typeof pair !== "object") return null;
      const label = typeof pair.label === "string" ? pair.label.trim().slice(0, 40) : "";
      const headline = typeof pair.headline === "string" ? pair.headline.trim().slice(0, 120) : "";
      if (!label || !headline) return null;
      localized[locale] = { label, headline };
    }
    slides.push({ layout: entry.layout as DeckSlideLayout, copy: localized });
  }

  const themeId = (DECK_THEME_IDS as readonly string[]).includes(String(raw.themeId))
    ? (raw.themeId as ThemeId)
    : DEFAULT_THEME_ID;
  const customTheme = normalizeDeckTheme(raw.theme);
  const appName = typeof raw.appName === "string" ? raw.appName.trim().slice(0, 40) : "";
  const summary = typeof raw.summary === "string" ? raw.summary.trim().slice(0, 500) : "";
  if (!appName || !summary) return null;

  return { appName, themeId, ...(customTheme ? { customTheme } : {}), summary, slides };
}

/** Validate the model's custom palette; a bad palette degrades to themeId. */
function normalizeDeckTheme(raw: unknown): Theme | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const colors: Record<string, string> = {};
  for (const key of ["bg", "bgAlt", "fg", "fgAlt", "accent", "muted"] as const) {
    const entry = typeof value[key] === "string" ? (value[key] as string).trim() : "";
    if (!HEX_COLOR.test(entry)) return null;
    colors[key] = entry;
  }
  const name =
    typeof value.name === "string" && value.name.trim()
      ? value.name.trim().slice(0, 40)
      : "AI Custom";
  return {
    id: "ai-custom",
    name,
    bg: colors.bg,
    bgAlt: colors.bgAlt,
    fg: colors.fg,
    fgAlt: colors.fgAlt,
    accent: colors.accent,
    muted: colors.muted,
  };
}
