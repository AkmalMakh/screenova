import { nid } from "./defaults";
import { buildSuggestedSlides, type SlideAnalysis } from "./import-slides";
import type { Device, Slide } from "./types";

// While a first draft streams in, the project holds one placeholder screen per
// expected screen: the user's screenshot in a phone, no copy yet. Each drafted
// screen replaces its placeholder in place, keeping the placeholder's id so
// the editor's selection and scroll position survive the swap.

const PLACEHOLDER: SlideAnalysis = { layout: "hero", copy: {}, showDeviceFrame: true };

export function placeholderSlides(count: number, paths: string[], locales: string[], device: Device): Slide[] {
  // Screens beyond the screenshots have no phone behind them; a deck drafted
  // from a description alone starts as plain cards.
  const analysis = Array.from({ length: count }, (_, index) => ({
    ...PLACEHOLDER,
    showDeviceFrame: index < paths.length,
  }));
  return buildSuggestedSlides(analysis, paths, locales, device);
}

export function mergeDraftSlides(
  current: Slide[],
  drafted: Array<SlideAnalysis | undefined>,
  total: number,
  paths: string[],
  locales: string[],
  device: Device,
): Slide[] {
  const next: Slide[] = [];
  for (let index = 0; index < total; index += 1) {
    const existing = current[index];
    const analysis = drafted[index];
    const path = paths[index] ?? "";
    if (analysis) {
      const [slide] = buildSuggestedSlides([analysis], [path], locales, device);
      next.push({ ...slide, id: existing?.id ?? slide.id });
    } else if (existing) {
      next.push(path && !existing.screenshot ? { ...existing, screenshot: path } : existing);
    } else {
      const [slide] = placeholderSlides(1, path ? [path] : [], locales, device);
      next.push({ ...slide, id: nid() });
    }
  }
  return next;
}
