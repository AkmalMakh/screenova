import { describe, expect, it } from "vitest";
import { buildSlidesFromAnalysis, clampLayout } from "./import-slides";

describe("clampLayout", () => {
  it("passes the five allowed layouts through on a phone", () => {
    for (const layout of ["hero", "device-bottom", "device-top", "two-devices", "no-device"]) {
      expect(clampLayout(layout as never, "iphone")).toBe(layout);
    }
  });

  it("maps split-landscape to device-bottom on a phone", () => {
    expect(clampLayout("split-landscape", "iphone")).toBe("device-bottom");
  });

  it("maps feature-graphic to device-bottom on a phone", () => {
    expect(clampLayout("feature-graphic", "iphone")).toBe("device-bottom");
  });

  it("forces feature-graphic on the feature-graphic device", () => {
    for (const layout of ["hero", "device-bottom", "split-landscape", "no-device"]) {
      expect(clampLayout(layout as never, "feature-graphic")).toBe("feature-graphic");
    }
  });
});

describe("buildSlidesFromAnalysis", () => {
  it("builds a single slide with localized copy and the screenshot path", () => {
    const [slide] = buildSlidesFromAnalysis(
      [
        {
          layout: "device-bottom",
          copy: {
            en: { label: "FAST", headline: "Everything in seconds." },
            de: { label: "SCHNELL", headline: "Alles in Sekunden." },
          },
        },
      ],
      ["/screenshots/uploaded/abc123.png"],
      ["en", "de"],
      "iphone",
    );
    expect(slide.id).toBeTruthy();
    expect(slide.layout).toBe("device-bottom");
    expect(slide.label).toEqual({ en: "FAST", de: "SCHNELL" });
    expect(slide.headline).toEqual({ en: "Everything in seconds.", de: "Alles in Sekunden." });
    expect(slide.screenshot).toBe("/screenshots/uploaded/abc123.png");
  });

  it("pairs paths in order and keeps ids unique", () => {
    const slides = buildSlidesFromAnalysis(
      [
        { layout: "hero", copy: { en: { label: "A", headline: "One." } } },
        { layout: "device-top", copy: { en: { label: "B", headline: "Two." } } },
        { layout: "no-device", copy: { en: { label: "C", headline: "Three." } } },
      ],
      ["/screenshots/uploaded/1.png", "/screenshots/uploaded/2.png", "/screenshots/uploaded/3.png"],
      ["en"],
      "ipad",
    );
    expect(slides.map((slide) => slide.screenshot)).toEqual([
      "/screenshots/uploaded/1.png",
      "/screenshots/uploaded/2.png",
      "/screenshots/uploaded/3.png",
    ]);
    expect(new Set(slides.map((slide) => slide.id)).size).toBe(slides.length);
  });

  it("omits empty copy so pickText can fall back to another locale", () => {
    const [slide] = buildSlidesFromAnalysis(
      [
        {
          layout: "hero",
          copy: {
            en: { label: "FAST", headline: "Everything in seconds." },
            de: { label: "", headline: "" },
          },
        },
      ],
      ["/screenshots/uploaded/abc.png"],
      ["en", "de"],
      "iphone",
    );
    expect(slide.label).toEqual({ en: "FAST" });
    expect(slide.headline).toEqual({ en: "Everything in seconds." });
  });

  it("omits locales missing from the analysis copy", () => {
    const [slide] = buildSlidesFromAnalysis(
      [{ layout: "hero", copy: { en: { label: "FAST", headline: "Fast." } } }],
      ["/screenshots/uploaded/abc.png"],
      ["en", "fr"],
      "iphone",
    );
    expect(slide.label).toEqual({ en: "FAST" });
  });

  it("returns an empty array for empty input", () => {
    expect(buildSlidesFromAnalysis([], [], ["en"], "iphone")).toEqual([]);
  });

  it("clamps layouts per device", () => {
    const [phoneSlide] = buildSlidesFromAnalysis(
      [{ layout: "device-top", copy: { en: { label: "A", headline: "One." } } }],
      ["/screenshots/uploaded/a.png"],
      ["en"],
      "iphone",
    );
    expect(phoneSlide.layout).toBe("device-top");
    const [fgSlide] = buildSlidesFromAnalysis(
      [{ layout: "hero", copy: { en: { label: "A", headline: "One." } } }],
      ["/screenshots/uploaded/a.png"],
      ["en"],
      "feature-graphic",
    );
    expect(fgSlide.layout).toBe("feature-graphic");
  });

  it("falls back to an empty screenshot when paths run short", () => {
    const [slide] = buildSlidesFromAnalysis(
      [{ layout: "hero", copy: { en: { label: "A", headline: "One." } } }],
      [],
      ["en"],
      "iphone",
    );
    expect(slide.screenshot).toBe("");
  });
});
