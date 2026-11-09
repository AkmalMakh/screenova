import { describe, expect, it } from "vitest";
import { mergeDraftSlides, placeholderSlides } from "./draft-slides";
import type { SlideAnalysis } from "./import-slides";

const designed = (headline: string): SlideAnalysis => ({
  layout: "device-bottom",
  copy: { en: { label: "PLAN", headline }, de: { label: "PLAN", headline: `${headline} (de)` } },
  showDeviceFrame: true,
});

describe("placeholder screens", () => {
  it("puts each screenshot in a phone and leaves later screens device-free", () => {
    const slides = placeholderSlides(3, ["/a.png", "/b.png"], ["en"], "iphone");
    expect(slides.map((slide) => slide.screenshot)).toEqual(["/a.png", "/b.png", ""]);
    expect(slides.map((slide) => slide.layout)).toEqual(["hero", "hero", "no-device"]);
    expect(slides.every((slide) => Object.keys(slide.headline).length === 0)).toBe(true);
  });
});

describe("merging a streaming draft", () => {
  it("swaps in drafted screens in place and keeps the placeholder ids", () => {
    const placeholders = placeholderSlides(3, ["/a.png", "", ""], ["en", "de"], "iphone");
    const merged = mergeDraftSlides(placeholders, [undefined, designed("Track spending")], 3, ["/a.png", "/b.png", "/c.png"], ["en", "de"], "iphone");
    expect(merged.map((slide) => slide.id)).toEqual(placeholders.map((slide) => slide.id));
    expect(merged[0]).toBe(placeholders[0]);
    expect(merged[1]).toMatchObject({ layout: "device-bottom", screenshot: "/b.png", headline: { en: "Track spending", de: "Track spending (de)" } });
    // A finished upload shows up before its design does.
    expect(merged[2].screenshot).toBe("/c.png");
  });

  it("follows the server's screen count", () => {
    const placeholders = placeholderSlides(5, [], ["en"], "iphone");
    expect(mergeDraftSlides(placeholders, [], 3, [], ["en"], "iphone").map((slide) => slide.id)).toEqual(placeholders.slice(0, 3).map((slide) => slide.id));
    const grown = mergeDraftSlides(placeholders.slice(0, 2), [], 4, [], ["en"], "iphone");
    expect(grown).toHaveLength(4);
    expect(new Set(grown.map((slide) => slide.id)).size).toBe(4);
  });
});
