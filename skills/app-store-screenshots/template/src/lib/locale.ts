import type { Device, LocalizedText, ProjectState } from "./types";

export const DEFAULT_LOCALE = "en";

// Content languages selectable when creating a project. Separate from the UI
// chrome languages in ui-i18n.tsx — these become the project's locales and
// drive the toolbar content-locale switcher and multi-language copy.
export const CONTENT_LANGUAGES: readonly { code: string; name: string }[] = [
  { code: "en", name: "English" },
  { code: "de", name: "Deutsch" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "zh", name: "中文" },
  { code: "ja", name: "日本語" },
  { code: "ko", name: "한국어" },
];

// AI/imported copy can contain literal (sometimes double-escaped) newline
// tokens. They are not intentional Enter line breaks; render them as spaces.
export function normalizeCopyText(value: string): string {
  return value.replace(/(?:[ \t]*\\+(?:r\\+n|[nr])[ \t]*)+/g, " ");
}

// Read the value for `locale` from a localized field. Falls back to en, then to
// the first locale that has a non-empty value, then to empty string. Used by
// the canvas/preview/thumb so switching to a locale the user hasn't filled in
// shows the source copy instead of blanks.
export function pickText(field: LocalizedText | undefined, locale: string): string {
  if (!field) return "";
  const direct = field[locale];
  if (direct && direct.length) return normalizeCopyText(direct);
  const en = field[DEFAULT_LOCALE];
  if (en && en.length) return normalizeCopyText(en);
  for (const k of Object.keys(field)) {
    const v = field[k];
    if (v && v.length) return normalizeCopyText(v);
  }
  return "";
}

// Replace `{locale}` placeholders in a screenshot path. Data URLs and empty
// strings pass through unchanged.
export function resolveScreenshot(path: string | undefined, locale: string): string {
  if (!path) return "";
  if (path.startsWith("data:")) return path;
  if (!path.includes("{locale}")) return path;
  return path.replace(/\{locale\}/g, locale);
}

export function resolveLocalizedScreenshot(
  path: string | undefined,
  overrides: Partial<Record<string, string>> | undefined,
  locale: string,
): string {
  return resolveScreenshot(overrides?.[locale] || path, locale);
}

// Convert legacy `string` headline/label fields to the per-locale shape. Safe
// to call on already-migrated data.
export function coerceLocalized(value: unknown): LocalizedText {
  if (typeof value === "string") return { [DEFAULT_LOCALE]: normalizeCopyText(value) };
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const next: LocalizedText = {};
    let changed = false;
    for (const [locale, text] of Object.entries(value)) {
      if (typeof text !== "string") { changed = true; continue; }
      next[locale] = normalizeCopyText(text);
      if (next[locale] !== text) changed = true;
    }
    return changed ? next : value as LocalizedText;
  }
  return {};
}

// Set or clear the value for `locale` on a localized field. Empty values delete
// the key so the persisted JSON stays free of "" placeholders.
export function writeLocalized(
  field: LocalizedText | undefined,
  locale: string,
  value: string,
): LocalizedText {
  const next: LocalizedText = { ...(field || {}) };
  if (value.length === 0) delete next[locale];
  else next[locale] = normalizeCopyText(value);
  return next;
}

// Cover every incoming editor update (AI Apply, imports, new text elements),
// not just edits routed through writeLocalized. Preserve unchanged identities
// and all non-copy assets/transforms so canvas dragging is unaffected.
export function normalizeProjectCopy(project: ProjectState): ProjectState {
  const slidesByDevice = { ...project.slidesByDevice };
  let changed = false;
  for (const [device, deck] of Object.entries(project.slidesByDevice)) {
    const slides = deck.map((slide) => {
      const label = coerceLocalized(slide.label);
      const headline = coerceLocalized(slide.headline);
      const textElements = slide.textElements?.map((element) => {
        const text = coerceLocalized(element.text);
        return text === element.text ? element : { ...element, text };
      });
      const elementsChanged = textElements?.some((element, i) => element !== slide.textElements![i]);
      if (label === slide.label && headline === slide.headline && !elementsChanged) return slide;
      return { ...slide, label, headline, ...(elementsChanged ? { textElements } : {}) };
    });
    if (slides.some((slide, i) => slide !== deck[i])) {
      changed = true;
      slidesByDevice[device as Device] = slides;
    }
  }
  return changed ? { ...project, slidesByDevice } : project;
}
