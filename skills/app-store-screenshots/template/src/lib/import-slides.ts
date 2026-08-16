import { nid } from "./defaults";
import type { Device, LocalizedText, Slide } from "./types";

// One analyzed screenshot → one slide spec, in input order. Copy is keyed by
// content locale so a multi-language project gets copy for every locale.
export type SlideAnalysis = {
  layout: "hero" | "device-bottom" | "device-top" | "two-devices" | "no-device";
  copy: Record<string, { label: string; headline: string }>;
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
    };
  });
}
