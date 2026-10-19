import { describe, expect, it } from "vitest";
import { galleryPublishSchema, galleryTemplateSchema, slidesFromTemplate, themeFromTemplate, toGalleryTemplate } from "./gallery";
import { mergeWithDefaults } from "./storage";
import type { ProjectState, Slide } from "./types";

const slide = (id: string, extra: Partial<Slide> = {}): Slide => ({
  id,
  layout: "device-bottom",
  label: { en: "PLAN" },
  headline: { en: "Plan your day" },
  screenshot: `/api/assets/owner/${id}.png`,
  ...extra,
});

function project(slides: Slide[]): ProjectState {
  return mergeWithDefaults({
    appName: "Mote",
    appIcon: "/api/assets/owner/icon.png",
    device: "iphone",
    locales: ["en", "de"],
    locale: "de",
    themeId: "clean-light",
    customThemesByDevice: { iphone: { id: "ai-custom-iphone", name: "Blush", bg: "#fff5f8", bgAlt: "#1c1c1e", fg: "#131316", fgAlt: "#f5f5f7", accent: "#e0457b", muted: "#6e6e77" } },
    slidesByDevice: { iphone: slides } as ProjectState["slidesByDevice"],
  });
}

describe("gallery templates share the design, never the app", () => {
  it("drops screenshots, the app icon, generated images and canvas offsets", () => {
    // Value: protects=a published template carries no private asset paths; fails_when=another user's project references the publisher's screenshots or icon
    const template = toGalleryTemplate(project([
      slide("a", {
        screenshotSecondary: "/api/assets/owner/b.png",
        screenshotByLocale: { de: "/api/assets/owner/a-de.png" },
        visualAsset: { src: "/api/assets/owner/gen.png", prompt: "glow", opacity: 0.7 },
        canvasOffset: { x: 40, y: 0 },
        backgroundFill: { angle: 180, stops: [{ color: "#ffffff", position: 0 }, { color: "#f6c9e4", position: 100 }] },
        frameStyle: "white",
      }),
    ]));
    const serialized = JSON.stringify(template);
    expect(serialized).not.toContain("/api/assets");
    expect(serialized).not.toMatch(/screenshot|visualAsset|canvasOffset|appIcon/);
    expect(template.slides[0]).toMatchObject({ layout: "device-bottom", frameStyle: "white", headline: { en: "Plan your day" } });
    expect(template).toMatchObject({ device: "iphone", locales: ["en", "de"], locale: "de", customTheme: { accent: "#e0457b" } });
  });

  it("drops elements that fail the allowlist instead of failing the whole deck", () => {
    // Value: protects=hand-edited out-of-range decorations or non-hex colors never reach other users; fails_when=one odd element blocks publishing or leaks a CSS url()
    const template = toGalleryTemplate(project([
      slide("a", {
        decorations: [
          { id: "ok", kind: "ellipse", transform: { x: 0, y: 0, width: 100, height: 100 }, fill: { type: "solid", colors: ["#ffffff"] }, opacity: 0.5 },
          { id: "bad", kind: "ellipse", transform: { x: 0, y: 0, width: 100, height: 100 }, fill: { type: "solid", colors: ["url(https://tracker.example/p.png)"] }, opacity: 0.5 },
        ],
        textElements: [
          { id: "t", text: { en: "Hi" }, transform: { x: 0, y: 0, width: 10, height: 10 }, color: "red" },
        ],
      }),
    ]));
    expect(template.slides[0].decorations?.map((item) => item.id)).toEqual(["ok"]);
    expect(template.slides[0].textElements).toEqual([]);
    expect(JSON.stringify(template)).not.toContain("tracker.example");
  });

  it("rebuilds editor slides with fresh IDs and empty screenshot slots", () => {
    const template = toGalleryTemplate(project([slide("a"), slide("b")]));
    let n = 0;
    const slides = slidesFromTemplate(template, () => `new-${++n}`);
    expect(slides.map((item) => [item.id, item.screenshot])).toEqual([["new-1", ""], ["new-2", ""]]);
    expect(themeFromTemplate(template)).toMatchObject({ id: "gallery-iphone", accent: "#e0457b" });
  });

  it("rejects unknown keys at the top level only by stripping, and refuses bad previews", () => {
    const template = toGalleryTemplate(project([slide("a")]));
    const reparsed = galleryTemplateSchema.parse({ ...template, appIcon: "/api/assets/x.png", slides: [{ ...template.slides[0], screenshot: "/x.png" }] });
    expect(JSON.stringify(reparsed)).not.toContain("/x.png");
    expect(JSON.stringify(reparsed)).not.toContain("appIcon");
    const base = { title: "Deck", template };
    expect(galleryPublishSchema.safeParse({ ...base, previews: ["data:image/jpeg;base64,/9j/AA=="] }).success).toBe(true);
    expect(galleryPublishSchema.safeParse({ ...base, previews: ["data:image/svg+xml;base64,PHN2Zz4="] }).success).toBe(false);
    expect(galleryPublishSchema.safeParse({ ...base, previews: ["https://example.com/a.jpg"] }).success).toBe(false);
    expect(galleryPublishSchema.safeParse({ ...base, previews: [] }).success).toBe(false);
    expect(galleryPublishSchema.safeParse({ ...base, title: "  ", previews: ["data:image/jpeg;base64,/9j/AA=="] }).success).toBe(false);
  });
});
