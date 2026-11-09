import type { LocalizedText, ProjectState, Slide } from "./types";

// Adding a language in the editor: every caption in the language being
// edited is sent once (iPhone and iPad often share a headline), and each
// translation comes back keyed by the source text it was written from. Keying
// by text means an edit made while Claude was writing simply gets no
// translation, instead of receiving one meant for its old words.

export type CopyKind = "label" | "headline" | "text";
export type CopyItem = { id: string; kind: CopyKind; text: string };
/** Source text -> locale -> translation. */
export type Translations = Record<string, Record<string, string>>;

export const MAX_COPY_ITEMS = 300;
export const MAX_COPY_LENGTH = 500;

function fields(slide: Slide): Array<[CopyKind, LocalizedText]> {
  return [
    ["label", slide.label],
    ["headline", slide.headline],
    ...(slide.textElements ?? []).map((element): [CopyKind, LocalizedText] => ["text", element.text]),
  ];
}

/** Every distinct caption written in `source`, across all devices. */
export function collectCopy(state: ProjectState, source: string): CopyItem[] {
  const items: CopyItem[] = [];
  const seen = new Set<string>();
  for (const slides of Object.values(state.slidesByDevice)) {
    for (const slide of slides ?? []) {
      for (const [kind, text] of fields(slide)) {
        const value = text?.[source]?.trim();
        if (!value || value.length > MAX_COPY_LENGTH || seen.has(value)) continue;
        seen.add(value);
        items.push({ id: `t${items.length + 1}`, kind, text: value });
        if (items.length === MAX_COPY_ITEMS) return items;
      }
    }
  }
  return items;
}

/** Writes translations into every caption whose source text they were made from. */
export function applyTranslations(
  state: ProjectState,
  source: string,
  translations: Translations,
  overwrite: boolean,
): ProjectState {
  const write = (text: LocalizedText): LocalizedText => {
    const written = translations[text?.[source]?.trim() ?? ""];
    if (!written) return text;
    const next = { ...text };
    for (const [locale, value] of Object.entries(written)) {
      if (locale === source || !value.trim()) continue;
      if (overwrite || !next[locale]?.trim()) next[locale] = value;
    }
    return next;
  };
  const slidesByDevice = Object.fromEntries(
    Object.entries(state.slidesByDevice).map(([device, slides]) => [
      device,
      (slides ?? []).map((slide) => ({
        ...slide,
        label: write(slide.label),
        headline: write(slide.headline),
        ...(slide.textElements
          ? { textElements: slide.textElements.map((element) => ({ ...element, text: write(element.text) })) }
          : {}),
      })),
    ]),
  ) as ProjectState["slidesByDevice"];
  return { ...state, slidesByDevice };
}
