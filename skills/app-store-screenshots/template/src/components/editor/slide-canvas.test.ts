import { describe, expect, it } from "vitest";
import { newSlide } from "@/lib/defaults";
import type { Slide } from "@/lib/types";
import { getCanvas, getElementTransform, layoutChangePatch } from "./slide-canvas";

function withSubhead(layout: Slide["layout"], offset: number): Slide {
  const slide = newSlide(layout);
  const caption = getElementTransform(slide, "iphone", "portrait", "caption")!;
  return {
    ...slide,
    textElements: [
      {
        id: "sub",
        text: { en: "Track every habit" },
        transform: { x: caption.x, y: caption.y + offset, width: caption.width, height: 120 },
      },
    ],
  };
}

describe("layoutChangePatch", () => {
  it("moves a subhead with the headline when the caption changes sides", () => {
    const slide = withSubhead("device-top", 260);
    const patch = layoutChangePatch(slide, "device-bottom", "iphone", "portrait");
    const caption = getElementTransform({ ...slide, ...patch }, "iphone", "portrait", "caption")!;

    expect(patch.layout).toBe("device-bottom");
    expect(patch.textElements?.[0].transform.y).toBeCloseTo(caption.y + 260);
    expect(patch.textElements?.[0].text).toEqual({ en: "Track every habit" });
  });

  it("moves the phone clear of text the default layout has no room for", () => {
    const slide = withSubhead("device-top", 520);
    const patch = layoutChangePatch(slide, "device-bottom", "iphone", "portrait");
    const next = { ...slide, ...patch };
    const sub = patch.textElements![0].transform;
    const phone = getElementTransform(next, "iphone", "portrait", "device")!;
    const fallback = getElementTransform({ ...next, transforms: undefined }, "iphone", "portrait", "device")!;

    expect(phone.y).toBeGreaterThan(sub.y + sub.height);
    expect(phone.y).toBeGreaterThan(fallback.y);
    expect(phone.x).toBe(fallback.x);
  });

  it("clears the words, not an oversized text box", () => {
    // A two-line, 51px subhead in a 344px box, as the AI drafts them.
    const slide = withSubhead("device-top", 304);
    slide.textElements![0] = {
      ...slide.textElements![0],
      text: { en: "Color-coded tasks, repeats, reminders,\nwork vs personal" },
      fontSize: 51,
      transform: { ...slide.textElements![0].transform, width: 1102, height: 344 },
    };
    const patch = layoutChangePatch(slide, "device-bottom", "iphone", "portrait");
    const sub = patch.textElements![0].transform;
    const phone = getElementTransform({ ...slide, ...patch }, "iphone", "portrait", "device")!;

    // The words are centered in the box: they end about 225px down, not 344.
    expect(phone.y).toBeGreaterThan(sub.y + (344 + 2 * 51) / 2);
    expect(phone.y).toBeLessThan(sub.y + 344);
  });

  it("keeps the layout's phone position when the text already fits", () => {
    const slide = withSubhead("device-bottom", 0);
    slide.textElements![0].transform.height = 10;
    const patch = layoutChangePatch(slide, "hero", "iphone", "portrait");
    expect(patch.transforms).toBeUndefined();
  });

  it("starts from the saved headline position, not the old layout default", () => {
    const slide = withSubhead("device-bottom", 200);
    const saved = { x: 100, y: 40, width: 1000, height: 500 };
    slide.transforms = { caption: saved };
    slide.textElements![0].transform = { ...slide.textElements![0].transform, x: saved.x, y: saved.y + 200 };

    const patch = layoutChangePatch(slide, "device-top", "iphone", "portrait");
    const caption = getElementTransform({ ...slide, ...patch }, "iphone", "portrait", "caption")!;

    expect(patch.textElements?.[0].transform.y).toBeCloseTo(caption.y + 200);
    expect(patch.textElements?.[0].transform.x).toBeCloseTo(caption.x);
  });

  it("keeps moved text inside the canvas", () => {
    const slide = withSubhead("device-bottom", 0);
    const { cH } = getCanvas("iphone", "portrait");
    slide.textElements![0].transform.y = cH - 150;

    const patch = layoutChangePatch(slide, "device-top", "iphone", "portrait");

    expect(patch.textElements?.[0].transform.y).toBe(cH - 120);
  });

  it("leaves screens without text boxes alone", () => {
    const patch = layoutChangePatch(newSlide("device-top"), "hero", "iphone", "portrait");
    expect(patch).toEqual({ layout: "hero", transforms: undefined, screenshotSecondary: undefined });
  });

  it("carries the screenshot into the back phone for two devices", () => {
    const slide = { ...newSlide("hero"), screenshot: "/screenshots/en/1.png" };
    expect(layoutChangePatch(slide, "two-devices", "iphone", "portrait").screenshotSecondary).toBe("/screenshots/en/1.png");
  });
});
