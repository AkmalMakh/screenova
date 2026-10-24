import { pickText, writeLocalized } from "./locale";
import type { Slide } from "./types";

export type CopyPair = { headline: string; subheader: string };

// Accepts "Headline | Subheader" (or tab-separated) rows, blank-line blocks,
// or alternating headline/subheader lines.
export function parseBulkCopy(input: string): CopyPair[] {
  const normalized = input.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return [];
  const lines = normalized.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.some((line) => line.includes("|") || line.includes("\t"))) {
    return lines
      .map((line) => {
        const separator = line.includes("|") ? "|" : "\t";
        const [headline, ...rest] = line.split(separator);
        return { headline: headline.trim(), subheader: rest.join(separator).trim() };
      })
      .filter((pair) => pair.headline || pair.subheader);
  }
  const blocks = normalized.split(/\n\s*\n/g).map((block) => block.trim()).filter(Boolean);
  if (blocks.length > 1) {
    return blocks.map((block) => {
      const [headline = "", ...rest] = block.split("\n").map((line) => line.trim());
      return { headline, subheader: rest.join("\n").trim() };
    });
  }
  const pairs: CopyPair[] = [];
  for (let i = 0; i < lines.length; i += 2) {
    pairs.push({ headline: lines[i] || "", subheader: lines[i + 1] || "" });
  }
  return pairs.filter((pair) => pair.headline || pair.subheader);
}

export function captionElementIndex(slide: Slide): number {
  const elements = slide.textElements || [];
  const captionIndex = elements.findIndex((element) => element.id === "caption");
  if (captionIndex >= 0) return captionIndex;
  return elements.length > 0 ? 0 : -1;
}

// One row per screen can't carry a line break; a break reads as a space.
const flat = (text: string) => text.replace(/\s*\n\s*/g, " ").trim();

function subheaderOf(slide: Slide, locale: string): string {
  const index = captionElementIndex(slide);
  return index >= 0 ? pickText(slide.textElements![index].text, locale) : "";
}

// The deck's current copy in the editor's own format, so "Edit copy" opens on
// what is there instead of an empty box. Every row keeps the "|" so the
// parser never falls back to alternating-line mode.
export function serializeBulkCopy(slides: Slide[], locale: string): string {
  return slides
    .map((slide) => `${flat(pickText(slide.headline, locale))} | ${flat(subheaderOf(slide, locale))}`.trimEnd())
    .join("\n");
}

// Patches for the rows the user actually changed. An untouched row is
// skipped entirely, so a headline's intentional line breaks survive an Apply.
export function planBulkCopy(
  slides: Slide[],
  pairs: CopyPair[],
  locale: string,
): { patches: Map<number, Partial<Slide>>; changed: number } {
  const patches = new Map<number, Partial<Slide>>();
  slides.forEach((slide, index) => {
    const pair = pairs[index];
    if (!pair) return;
    const patch: Partial<Slide> = {};
    if (pair.headline && pair.headline !== flat(pickText(slide.headline, locale))) {
      patch.headline = writeLocalized(slide.headline, locale, pair.headline);
    }
    if (pair.subheader && pair.subheader !== flat(subheaderOf(slide, locale))) {
      const subheaderIndex = captionElementIndex(slide);
      if (subheaderIndex >= 0) {
        patch.textElements = (slide.textElements || []).map((element, elementIndex) =>
          elementIndex === subheaderIndex
            ? { ...element, text: writeLocalized(element.text, locale, pair.subheader) }
            : element,
        );
      }
    }
    if (Object.keys(patch).length) patches.set(index, patch);
  });
  return { patches, changed: patches.size };
}
