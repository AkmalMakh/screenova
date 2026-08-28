import { z } from "zod";
import { CANVAS, DEFAULT_THEME_ID, THEMES } from "./constants";
import { DECORATION_ICON_NAMES } from "./decoration-icon-names";
import {
  headlineFontFamilySchema,
  normalizeResponseDecoration,
  normalizeResponseTransform,
  responseDecorationElementSchema,
  responseElementTransformSchema,
} from "./design";
import type { SlideAnalysis } from "./import-slides";
import type {
  DecorationElement,
  Device,
  ElementTransform,
  TextElement,
  Theme,
  ThemeId,
} from "./types";

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
// Re-exported so the route keeps a single import site; defined in constants.ts
// because the studio composer needs them too and must not pull zod in.
export {
  MAX_REFERENCE_SCREENSHOTS,
  MAX_REFERENCE_SCREENSHOTS_TOTAL,
  MAX_STYLE_REFERENCES,
} from "./constants";

export type StyleReferenceSummary = {
  name: string;
  hasImages: boolean;
};

const slideCopySchema = z.object({
  label: z.string().trim().min(1).max(40),
  headline: z.string().trim().min(1).max(120),
});

// Secondary copy (subheads, body paragraphs) and decorative widgets per screen.
// Bounded so one deck can't balloon the response past what the editor can
// sensibly render or a user can hand-edit afterwards.
export const MAX_DECK_TEXT_ELEMENTS = 4;
export const MAX_DECK_DECORATIONS = 14;

// The editor's TextElement is per-locale, but /api/design's response schema
// carries a single string because it edits one locale at a time. Deck drafting
// is multi-locale from the start, so build a literal-keyed text object the same
// way buildDeckSchema does for label/headline.
function buildDeckTextElementSchema(locales: string[]) {
  const textByLocale: Record<string, z.ZodString> = {};
  for (const locale of locales) textByLocale[locale] = z.string().max(240);
  return z.object({
    id: z.string().trim().min(1).max(80),
    text: z.object(textByLocale),
    transform: responseElementTransformSchema,
    fontSize: z.number().finite().min(12).max(400).nullable(),
    fontWeight: z.number().int().min(100).max(900).nullable(),
    color: z.string().regex(HEX_COLOR).nullable(),
    align: z.enum(["left", "center", "right"]).nullable(),
  });
}

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
  const textElementSchema = buildDeckTextElementSchema(locales);
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
          headlineFontFamily: headlineFontFamilySchema.nullable(),
          inverted: z.boolean().nullable(),
          // Where the device sits on this screen. Null keeps the layout's
          // default placement; a rect can push the device off-canvas so it
          // crops against an edge the way reference decks often do.
          deviceTransform: responseElementTransformSchema.nullable(),
          textElements: z.array(textElementSchema).max(MAX_DECK_TEXT_ELEMENTS),
          decorations: z.array(responseDecorationElementSchema).max(MAX_DECK_DECORATIONS),
        }),
      )
      .length(count),
  });
}

export function buildDeckPrompt(
  locales: string[],
  device: Device,
  count: number,
  screenshotCount = 0,
  styleReferences: StyleReferenceSummary[] = [],
): string {
  const canvas = CANVAS[device] ?? CANVAS.iphone;
  const themeGuide = DECK_THEME_IDS.map((id) => `- ${id}: ${THEMES[id].name}`).join("\n");
  const slideRules =
    screenshotCount > 0
      ? `The user attached ${screenshotCount} screenshots of their app. Write exactly one slide per screenshot, in the same order — the first slide is about screenshot 1, and so on. Ground each label and headline in what that screenshot actually shows; never invent features the screenshots don't display. Every slide must use a layout that shows a device frame (hero, device-bottom, device-top, two-devices) — never "no-device". Vary the layouts for rhythm.`
      : `Vary the layouts across screens for visual rhythm; the first screen is a "hero" and the last is a "no-device" closer. Use at most one "two-devices" screen.`;
  const referenceRules = styleReferences.length
    ? `\n\nSTYLE REFERENCES — CLONE THE LAYOUT SYSTEM
The user attached ${styleReferences.length} reference app${styleReferences.length === 1 ? "" : "s"} whose App Store presence they want to match:
${styleReferences
  .map(
    (reference, index) =>
      `${index + 1}. ${reference.name}${reference.hasImages ? " — its store screenshots are attached below, labeled STYLE REFERENCE" : " — no screenshots available; go by what you know of this product"}`,
  )
  .join("\n")}
Your job is to REPRODUCE THE REFERENCE'S VISUAL STRUCTURE as closely as the schema allows, then pour the user's content into it. This is the primary objective — a deck that merely borrows the reference's colors is a failure. For each reference screen, read off and reproduce:
- DEVICE PLACEMENT: where the phone sits and how much of it is visible. Reference decks very often crop the device hard against an edge — only the bottom third of a phone hanging from the top of the screen, or the top half rising from the bottom. Reproduce that with deviceTransform, including negative x/y to push the device past the canvas edge.
- TEXT POSITION: is the copy above the device, below it, or overlaid? Reproduce it. If the reference puts the headline under a top-cropped phone, yours does too.
- TEXT STACK DEPTH: count the distinct blocks of type. A screen with an eyebrow label, a large headline, a bold one-line subhead, and a smaller body paragraph is four blocks — the label and headline go in copy, and the subhead and paragraph become textElements with their own sizes, weights, and positions.
- TYPOGRAPHY: if the reference's headlines are a serif, set headlineFontFamily to "editorial". Rounded and geometric sans map to "rounded" and "geometric". Match the weight contrast between the headline and its subhead.
- WIDGETS: reproduce floating decorative elements. Rounded app-icon tiles with a glyph are kind "icon-tile" with an iconName; rotate them slightly the way the reference does. Gradient orbs, blobs, and pills are "ellipse" or "rounded-rectangle". Match their count, scale, rotation, and scatter.
- BACKGROUND RHYTHM: which screens are light and which invert to a dark background.
What you must NOT take from the references: their headlines, subheads, body copy, feature claims, prices, statistics, brand names, product names, and logos. Structure and styling are yours to reuse; their words are not. Every string you emit must describe the USER'S app as they described it.`
    : "";
  const geometryRules = `\n\nCANVAS GEOMETRY
The canvas is ${canvas.w}×${canvas.h} pixels. All coordinates you emit are in these full-resolution canvas pixels.
- The origin is the TOP-LEFT corner. x grows right, y grows down.
- An element's x and y are its OWN TOP-LEFT corner, not its center.
- rotation is degrees clockwise about the element's center, applied after positioning.
- Coordinates may be negative or exceed the canvas to bleed an element off an edge. That is how you crop a device against the top edge: give it a negative y, or a y+height greater than ${canvas.h}.
- Keep headline and label text fully inside the canvas with comfortable margins (roughly ${Math.round(canvas.w * 0.08)}px from the left and right edges). Devices and decorations may bleed.
- zIndex orders elements: decorations sit at 1–2 when they are background texture, devices at 3, captions at 4. Put a widget ABOVE the device by giving it a zIndex of 5 or more.
- Sizes are absolute pixels too. On this canvas a headline is roughly ${Math.round(canvas.w * 0.075)}–${Math.round(canvas.w * 0.11)}px, a subhead ${Math.round(canvas.w * 0.045)}px, body copy ${Math.round(canvas.w * 0.033)}px, and a decorative icon tile ${Math.round(canvas.w * 0.1)}–${Math.round(canvas.w * 0.17)}px square.`;
  return `You are the template engine inside an App Store screenshot editor. The user has described their app and wants a starter template deck to begin designing from.${referenceRules}${geometryRules}

Draft exactly ${count} screens for a ${device}-frame App Store campaign:
- ${slideRules}
- label: a short feature keyword (≤40 characters). It renders as a small uppercase accent line.
- headline: punchy, outcome-led copy (≤120 characters). It renders as the main text. Keep it readable at thumbnail size.
- Never invent features, testimonials, prices, or facts beyond what the user described. If the description is thin, propose plausible, on-brand framing rather than specifics.
- For every screen, write label and headline in EACH of the project's languages: ${locales.join(", ")}. The response's copy object must contain an entry for every one of these locale codes, with no extra codes.

Per-screen structure. Every field below is required on every screen; send null (or an empty array) when a screen genuinely does not need it — but ${styleReferences.length ? "with references attached, screens that use none of these are almost certainly under-designed" : "use them wherever they earn their place"}.
- headlineFontFamily: "modern", "editorial" (serif), "geometric", "rounded", or "mono". Null inherits the theme default.
- inverted: true renders the screen on the theme's dark background instead of the light one. Use it for 1–2 emphasis screens.
- deviceTransform: {x, y, width, height, rotation, zIndex} for the device, or null to keep the layout's default placement. Preserve the device's aspect ratio when you resize it — for a phone, height is roughly 2.17× width.
- textElements: up to ${MAX_DECK_TEXT_ELEMENTS} extra text blocks beyond label and headline — subheads, body paragraphs, small captions. Each carries its own transform, fontSize, fontWeight (400 body, 700 bold subhead), color, and align. The text object needs an entry for every project language, exactly like copy. Give each a short unique id like "subhead" or "body".
- decorations: up to ${MAX_DECK_DECORATIONS} decorative shapes. kind is "ellipse", "rounded-rectangle", "line", or "icon-tile". Every decoration needs a unique id, a transform, a fill ({type: "solid" | "linear-gradient", colors: 1–3 hex values, angle}), and an opacity. "icon-tile" additionally takes iconName from this list — ${DECORATION_ICON_NAMES.join(", ")} — plus iconColor for the glyph drawn on the tile. Pick the icon that matches the feature the screen is selling.

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
    slides.push({
      layout: entry.layout as DeckSlideLayout,
      copy: localized,
      ...normalizeDeckSlideDesign(entry, locales),
    });
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

// The design half of a slide: font, inversion, device placement, and the
// element arrays. Every field degrades independently — a malformed decoration
// is dropped without costing the deck its copy, because a template the user
// can edit beats a hard failure.
function normalizeDeckSlideDesign(
  entry: Record<string, unknown>,
  locales: string[],
): Partial<SlideAnalysis> {
  const design: Partial<SlideAnalysis> = {};

  const font = entry.headlineFontFamily;
  if (headlineFontFamilySchema.safeParse(font).success) {
    design.headlineFontFamily = font as SlideAnalysis["headlineFontFamily"];
  }
  if (typeof entry.inverted === "boolean") design.inverted = entry.inverted;

  const deviceTransform = responseElementTransformSchema.safeParse(entry.deviceTransform);
  if (deviceTransform.success) {
    design.deviceTransform = normalizeResponseTransform(deviceTransform.data);
  }

  // Element ids only need to be unique within their own slide — the editor
  // scopes them by slide id — but a duplicate inside one slide would make two
  // elements share a selection target, so drop the later one.
  const textElements: TextElement[] = [];
  const seenText = new Set<string>();
  if (Array.isArray(entry.textElements)) {
    for (const raw of entry.textElements.slice(0, MAX_DECK_TEXT_ELEMENTS)) {
      const element = normalizeDeckTextElement(raw, locales);
      if (!element || seenText.has(element.id)) continue;
      seenText.add(element.id);
      textElements.push(element);
    }
  }
  if (textElements.length) design.textElements = textElements;

  const decorations: DecorationElement[] = [];
  const seenDecoration = new Set<string>();
  if (Array.isArray(entry.decorations)) {
    for (const raw of entry.decorations.slice(0, MAX_DECK_DECORATIONS)) {
      const parsed = responseDecorationElementSchema.safeParse(raw);
      if (!parsed.success) continue;
      const element = normalizeResponseDecoration(parsed.data);
      if (seenDecoration.has(element.id)) continue;
      seenDecoration.add(element.id);
      decorations.push(element);
    }
  }
  if (decorations.length) design.decorations = decorations;

  return design;
}

/** One extra text block, with its per-locale strings collapsed to what's set. */
function normalizeDeckTextElement(raw: unknown, locales: string[]): TextElement | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const id = typeof value.id === "string" ? value.id.trim().slice(0, 80) : "";
  if (!id) return null;

  const transform = responseElementTransformSchema.safeParse(value.transform);
  if (!transform.success) return null;

  const source = (value.text ?? {}) as Record<string, unknown>;
  const text: TextElement["text"] = {};
  for (const locale of locales) {
    const entry = typeof source[locale] === "string" ? (source[locale] as string).trim() : "";
    // Omit blanks so pickText can fall back to another locale, matching how
    // buildSlidesFromAnalysis treats label and headline.
    if (entry) text[locale] = entry.slice(0, 240);
  }
  if (!Object.keys(text).length) return null;

  const fontSize = typeof value.fontSize === "number" && Number.isFinite(value.fontSize)
    ? Math.max(12, Math.min(400, value.fontSize))
    : null;
  const fontWeight = typeof value.fontWeight === "number" && Number.isFinite(value.fontWeight)
    ? Math.max(100, Math.min(900, Math.round(value.fontWeight)))
    : null;
  const color = typeof value.color === "string" && HEX_COLOR.test(value.color) ? value.color : null;
  const align =
    value.align === "left" || value.align === "center" || value.align === "right"
      ? value.align
      : null;

  return {
    id,
    text,
    transform: normalizeResponseTransform(transform.data),
    ...(fontSize !== null ? { fontSize } : {}),
    ...(fontWeight !== null ? { fontWeight } : {}),
    ...(color !== null ? { color } : {}),
    ...(align !== null ? { align } : {}),
  };
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
