import { describe, expect, it } from "vitest";
import { adaptSlides, counterpartDevice, designSource, isStarterDeck, switchDevice, withCounterpartDesign, withDesignFrom } from "./platform-design";
import { DEFAULT_PROJECT } from "./defaults";
import type { ProjectState, Slide } from "./types";

const designed: Slide[] = [
  {
    id: "a",
    layout: "device-bottom",
    label: { en: "PLAN" },
    headline: { en: "Plan your day" },
    screenshot: "/screenshots/one.png",
    frameStyle: "white",
    headlineStyle: { fontSize: 120 } as Slide["headlineStyle"],
    transforms: { caption: { x: 110, y: 200, width: 1100, height: 400 } },
    textElements: [{ id: "t1", text: { en: "Free" }, transform: { x: 0, y: 2668, width: 400, height: 200 }, fontSize: 60 }],
    decorations: [{ id: "d1", kind: "ellipse", transform: { x: 1220, y: 0, width: 200, height: 200 }, fill: { type: "solid", colors: ["#ffffff"] }, opacity: 1, blur: 40 }],
    canvasOffset: { x: 50, y: 0 },
  },
  { id: "b", layout: "hero", label: { en: "TRACK" }, headline: { en: "Track it" }, screenshot: "" },
];

const project = (patch: Partial<ProjectState> = {}): ProjectState => ({
  ...DEFAULT_PROJECT,
  slidesByDevice: { ...DEFAULT_PROJECT.slidesByDevice, iphone: designed },
  customThemesByDevice: { iphone: { id: "ai-custom-iphone", name: "Grove", bg: "#eef4ee", bgAlt: "#1b3a2a", fg: "#10241a", fgAlt: "#f4f8f4", accent: "#2f7a52", muted: "#5b6e62" } },
  ...patch,
});

describe("one design for both stores", () => {
  it("pairs phones with phones and tablets with tablets", () => {
    expect(counterpartDevice("android")).toBe("iphone");
    expect(counterpartDevice("iphone")).toBe("android");
    expect(counterpartDevice("android-7")).toBe("ipad");
    expect(counterpartDevice("android-10", "landscape")).toBeNull();
    expect(counterpartDevice("feature-graphic")).toBeNull();
  });

  it("switching to an untouched Android deck adopts the iPhone design and palette", () => {
    // Value: protects=an iOS deck shows up on Android ready to export; fails_when=Android shows the generic starter screens
    const next = switchDevice(project(), "android");
    expect(next.device).toBe("android");
    const slides = next.slidesByDevice.android;
    expect(slides.map((slide) => [slide.headline.en, slide.screenshot, slide.frameStyle])).toEqual([
      ["Plan your day", "/screenshots/one.png", "white"],
      ["Track it", "", undefined],
    ]);
    expect(slides.map((slide) => slide.id)).not.toContain("a");
    expect(next.customThemesByDevice?.android).toMatchObject({ id: "ai-custom-android", accent: "#2f7a52" });
    expect(next.slidesByDevice.iphone).toBe(designed);
  });

  it("keeps an Android deck the user already edited", () => {
    const edited = [{ ...designed[1], id: "x", headline: { en: "Android only" } }];
    const state = project({ slidesByDevice: { ...project().slidesByDevice, android: edited } });
    expect(switchDevice(state, "android").slidesByDevice.android).toBe(edited);
    expect(withCounterpartDesign(state, "android").slidesByDevice.android[0].headline.en).toBe("Plan your day");
  });

  it("does nothing when the source is still the starter", () => {
    const fresh = { ...DEFAULT_PROJECT };
    expect(switchDevice(fresh, "android").slidesByDevice.android).toBe(DEFAULT_PROJECT.slidesByDevice.android);
    expect(isStarterDeck("android", fresh.slidesByDevice.android)).toBe(true);
  });

  it("an untouched iPad deck takes the iPhone look with empty screens to upload into", () => {
    const withDevice = project({ slidesByDevice: { ...project().slidesByDevice, iphone: [{ ...designed[0], transforms: { ...designed[0].transforms, device: { x: 160, y: 900, width: 1000, height: 2170 } }, screenshotByLocale: { de: "/screenshots/de.png" } }, designed[1]] } });
    const next = switchDevice(withDevice, "ipad");
    const [first, second] = next.slidesByDevice.ipad;
    expect(first).toMatchObject({ headline: { en: "Plan your day" }, frameStyle: "white", screenshot: "", layout: "device-bottom" });
    expect(first.screenshotByLocale).toBeUndefined();
    // The phone-shaped frame box is dropped so the layout places the tablet; the caption keeps its spot.
    expect(first.transforms?.device).toBeUndefined();
    expect(first.transforms?.caption).toBeDefined();
    expect(first.decorations).toHaveLength(1);
    expect(second.headline.en).toBe("Track it");
    expect(next.customThemesByDevice?.ipad).toMatchObject({ id: "ai-custom-ipad", accent: "#2f7a52" });
    // 1320×2868 to 2064×2752: text boxes widen with the canvas, type follows the
    // smaller (vertical) factor, so a headline wraps less instead of overlapping.
    expect(first.transforms?.caption?.width).toBe(Math.round(1100 * 2064 / 1320));
    expect(first.transforms?.caption?.height).toBe(Math.round(400 * 2752 / 2868));
    expect(first.headlineStyle?.fontSize).toBe(Math.round(120 * 2752 / 2868));
    expect(first.textElements?.[0].fontSize).toBe(Math.round(60 * 2752 / 2868));
  });

  it("finds a tablet's design on its store's tablet first, then on a phone", () => {
    expect(designSource(project(), "ipad")).toBe("iphone");
    expect(designSource(project(), "android-10")).toBe("iphone");
    const tablet = withDesignFrom(project(), "android-10", "iphone");
    expect(designSource(tablet, "ipad")).toBe("android-10");
    expect(designSource(project({ orientation: "landscape" }), "android-10")).toBeNull();
    // Phones still pair only with phones, keeping their screenshots.
    expect(withDesignFrom(project(), "android", "iphone").slidesByDevice.android[0].screenshot).toBe("/screenshots/one.png");
  });

  it("re-fits positions and sizes to the 1080×1920 canvas and drops workspace offsets", () => {
    const [slide] = adaptSlides(designed, "iphone", "android", "portrait", () => "new");
    // iPhone 1320×2868 → Android 1080×1920: x × 0.818, y × 0.669, sizes × 0.744.
    const caption = slide.transforms!.caption!;
    expect(caption.x + caption.width / 2).toBeCloseTo(540, -1);
    expect(caption.y + caption.height / 2).toBeCloseTo(268, -1);
    expect(caption.width).toBe(818);
    expect(slide.headlineStyle?.fontSize).toBe(89);
    const text = slide.textElements![0];
    expect(text.transform.y + text.transform.height).toBeLessThanOrEqual(1920);
    expect(text.fontSize).toBe(45);
    const deco = slide.decorations![0];
    expect(deco.transform.x + deco.transform.width / 2).toBeCloseTo(1080, -1);
    expect(deco.blur).toBe(30);
    expect(slide.canvasOffset).toBeUndefined();
    expect(slide.id).toBe("new");
  });
});
