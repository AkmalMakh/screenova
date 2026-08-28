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

  // The whole point of drafting a cloned layout is lost if the converter drops
  // it on the way to the editor, which is what it used to do.
  it("carries drafted design detail onto the slide", () => {
    const [slide] = buildSlidesFromAnalysis(
      [
        {
          layout: "device-top",
          copy: { en: { label: "REMIND", headline: "Schedule reminders" } },
          headlineFontFamily: "editorial",
          inverted: true,
          deviceTransform: { x: 160, y: -900, width: 1000, height: 2170, zIndex: 3 },
          captionTransform: { x: 106, y: 1900, width: 1108, height: 700 },
          textElements: [
            {
              id: "subhead",
              text: { en: "Never forget anything" },
              transform: { x: 120, y: 1500, width: 1080, height: 120 },
              fontSize: 60,
              fontWeight: 700,
            },
          ],
          decorations: [
            {
              id: "tile",
              kind: "icon-tile",
              transform: { x: 80, y: 1200, width: 200, height: 200, rotation: -12 },
              fill: { type: "linear-gradient", colors: ["#A78BFA", "#8B5CF6"], angle: 135 },
              opacity: 1,
              iconName: "alarm-clock",
            },
          ],
        },
      ],
      ["/screenshots/uploaded/a.png"],
      ["en"],
      "iphone",
    );
    expect(slide.headlineFontFamily).toBe("editorial");
    expect(slide.inverted).toBe(true);
    // Negative y is how a device crops against the top edge — it must survive.
    expect(slide.transforms?.device?.y).toBe(-900);
    // The drafted headline position has to land on the caption element, or the
    // text falls back to the layout default and collides with the device.
    expect(slide.transforms?.caption?.y).toBe(1900);
    expect(slide.textElements?.[0].text.en).toBe("Never forget anything");
    expect(slide.decorations?.[0].iconName).toBe("alarm-clock");
    expect(slide.decorations?.[0].transform.rotation).toBe(-12);
  });

  // A device rect drafted for device-top means nothing once the layout has been
  // rewritten to fit another device class.
  it("drops the device rect when the layout had to be clamped", () => {
    const [slide] = buildSlidesFromAnalysis(
      [
        {
          layout: "hero",
          copy: { en: { label: "A", headline: "One." } },
          deviceTransform: { x: 0, y: -400, width: 800, height: 1736 },
        },
      ],
      ["/screenshots/uploaded/a.png"],
      ["en"],
      "feature-graphic",
    );
    expect(slide.layout).toBe("feature-graphic");
    expect(slide.transforms).toBeUndefined();
  });
});
