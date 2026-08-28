import { nid } from "./defaults";
import type {
  DecorationElement,
  Device,
  ElementTransform,
  HeadlineFontFamily,
  LocalizedText,
  Slide,
  TextElement,
} from "./types";

// One analyzed screenshot → one slide spec, in input order. Copy is keyed by
// content locale so a multi-language project gets copy for every locale.
//
// Everything below `copy` is optional design detail. The analyze-screenshots
// path leaves it unset and gets the layout's default placement; suggest-deck
// fills it in when it is cloning a reference deck's structure.
export type SlideAnalysis = {
  layout: "hero" | "device-bottom" | "device-top" | "two-devices" | "no-device";
  copy: Record<string, { label: string; headline: string }>;
  headlineFontFamily?: HeadlineFontFamily;
  inverted?: boolean;
  deviceTransform?: ElementTransform;
  textElements?: TextElement[];
  decorations?: DecorationElement[];
};

// The analysis endpoint only suggests the five standard layouts, but clamp
// defensively in case a split-landscape or feature-graphic value ever arrives.
export function clampLayout(layout: Slide["layout"], device: Device): Slide["layout"] {
  if (device === "feature-graphic") return "feature-graphic";
  if (layout === "split-landscape" || layout === "feature-graphic") return "device-bottom";
  return layout;
}

export function buildSlidesFromAnalysis(
  analysis: SlideAnalysis[],
  paths: string[],
  locales: string[],
  device: Device,
): Slide[] {
  return analysis.map((item, index) => {
    const label: LocalizedText = {};
    const headline: LocalizedText = {};
    for (const locale of locales) {
      const copy = item.copy[locale];
      // Omit empty values so pickText falls back to another locale.
      if (copy?.label) label[locale] = copy.label;
      if (copy?.headline) headline[locale] = copy.headline;
    }
    return {
      id: nid(),
      layout: clampLayout(item.layout, device),
      label,
      headline,
      screenshot: paths[index] ?? "",
      ...(item.headlineFontFamily ? { headlineFontFamily: item.headlineFontFamily } : {}),
      ...(item.inverted ? { inverted: item.inverted } : {}),
      // A device rect only means anything against the layout it was drafted
      // for, so drop it when clampLayout had to rewrite the layout.
      ...(item.deviceTransform && clampLayout(item.layout, device) === item.layout
        ? { transforms: { device: item.deviceTransform } }
        : {}),
      ...(item.textElements?.length ? { textElements: item.textElements } : {}),
      ...(item.decorations?.length ? { decorations: item.decorations } : {}),
    };
  });
}
