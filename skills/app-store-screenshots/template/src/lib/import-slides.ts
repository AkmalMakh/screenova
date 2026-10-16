import type { BackgroundFill, FrameStyle, HeadlineStyle } from "./slide-appearance";
import { CANVAS } from "./constants";
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
  backgroundFill?: BackgroundFill;
  frameStyle?: FrameStyle;
  headlineStyle?: HeadlineStyle;
  /** Explicit framing intent from a generated design, even before assets arrive. */
  showDeviceFrame?: boolean;
  layout: "hero" | "device-bottom" | "device-top" | "two-devices" | "no-device";
  copy: Record<string, { label: string; headline: string }>;
  headlineFontFamily?: HeadlineFontFamily;
  inverted?: boolean;
  deviceTransform?: ElementTransform;
  captionTransform?: ElementTransform;
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
      ...(item.backgroundFill ? { backgroundFill: item.backgroundFill } : {}),
      ...(item.frameStyle ? { frameStyle: item.frameStyle } : {}),
      ...(item.headlineStyle ? { headlineStyle: item.headlineStyle } : {}),
      layout: clampLayout(item.layout, device),
      label,
      headline,
      screenshot: paths[index] ?? "",
      ...(item.headlineFontFamily ? { headlineFontFamily: item.headlineFontFamily } : {}),
      ...(item.inverted ? { inverted: item.inverted } : {}),
      // These rects only mean anything against the layout they were drafted
      // for, so drop them when clampLayout had to rewrite the layout.
      ...(clampLayout(item.layout, device) === item.layout &&
      (item.deviceTransform || item.captionTransform)
        ? {
            transforms: {
              ...(item.deviceTransform ? { device: item.deviceTransform } : {}),
              ...(item.captionTransform ? { caption: item.captionTransform } : {}),
            },
          }
        : {}),
      ...(item.textElements?.length ? { textElements: item.textElements } : {}),
      ...(item.decorations?.length ? { decorations: item.decorations } : {}),
    };
  });
}

/** Resolve the approved suggestion once for preview, editor and export.
 * An absent screenshot means an intentionally device-free composition, not a
 * request to invent an empty phone. Imports retain their existing behavior.
 */
export function buildSuggestedSlides(
  analysis: SlideAnalysis[], paths: string[], locales: string[], device: Device,
): Slide[] {
  const { w, h } = CANVAS[device];
  return buildSlidesFromAnalysis(analysis, paths, locales, device).map((slide, index) => {
    const source = analysis[index];
    const withoutDevice = source.layout === "no-device" || (!paths[index] && !source.showDeviceFrame);
    const caption = slide.transforms?.caption ?? {
      x: w * 0.08,
      y: h * (source.layout === "no-device" || (source.layout === "device-top" && withoutDevice) ? 0.35 : source.layout === "device-top" ? 0.72 : 0.06),
      width: w * 0.84, height: h * 0.28,
    };
    return {
      ...slide,
      layout: withoutDevice ? clampLayout("no-device", device) : slide.layout,
      backgroundStyle: "plain",
      transforms: withoutDevice ? { caption } : { ...slide.transforms, caption },
    };
  });
}
