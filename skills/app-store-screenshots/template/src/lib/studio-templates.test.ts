import { describe, expect, it } from "vitest";
import { STUDIO_TEMPLATES, buildTemplateSlides } from "./studio-templates";

describe("editable Studio presets", () => {
  it("creates the advertised layouts and independent slide ids", () => {
    for (const template of STUDIO_TEMPLATES) {
      const first = buildTemplateSlides(template, ["en", "de"]);
      const second = buildTemplateSlides(template, ["en", "de"]);
      expect(first).toHaveLength(template.slides);
      expect(first.map((slide) => slide.layout)).toEqual(template.layouts);
      expect(new Set([...first, ...second].map((slide) => slide.id)).size).toBe(template.slides * 2);
      expect(first.every((slide) => slide.headline.de && slide.headline.en)).toBe(true);
    }
  });
});
