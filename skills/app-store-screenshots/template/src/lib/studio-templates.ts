import { DEFAULT_PROJECT, nid } from "./defaults";
import { localizeStarterDeck } from "./starter-copy";
import type { SlideLayout, ThemeId } from "./types";

export type TemplateEntry = {
  id: string;
  name: string;
  thumb: string;
  slides: number;
  themeId: ThemeId;
  layouts: SlideLayout[];
};

export const STUDIO_TEMPLATES: TemplateEntry[] = [
  {
    id: "deck", name: "Feature tour", thumb: "/deck/01-hero.webp", slides: 9,
    themeId: "clean-light",
    layouts: ["hero", "split-landscape", "device-bottom", "two-devices", "device-top", "two-devices", "device-bottom", "two-devices", "device-top"],
  },
  {
    id: "deck-b", name: "Minimal three", thumb: "/deck-b/01-hero.webp", slides: 3,
    themeId: "clean-light", layouts: ["hero", "device-bottom", "two-devices"],
  },
  {
    id: "deck-c", name: "Bold contrast", thumb: "/deck-c/01-hero.webp", slides: 3,
    themeId: "dark-bold", layouts: ["hero", "device-top", "two-devices"],
  },
];

export function buildTemplateSlides(template: TemplateEntry, locales: string[]) {
  const starters = DEFAULT_PROJECT.slidesByDevice.iphone;
  return localizeStarterDeck(template.layouts.map((layout, index) => {
    const source = starters.find((slide) => slide.layout === layout) || starters[1];
    return { ...structuredClone(source), id: nid(), layout, inverted: index % 3 === 2 };
  }), locales);
}
