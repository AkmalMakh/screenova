import { describe, expect, it } from "vitest";
import { coerceLocalized, normalizeProjectCopy, pickText, writeLocalized } from "./locale";
import { DEFAULT_PROJECT } from "./defaults";
import { mergeWithDefaults } from "./storage";

describe("escaped line breaks in editor copy", () => {
  it("renders literal backslash-n as a space in the active language", () => {
    expect(pickText({ en: String.raw`Notice the days\nthat shape you` }, "en")).toBe("Notice the days that shape you");
  });
  it("also normalizes language fallback text", () => {
    expect(pickText({ en: String.raw`Plan\nyour day` }, "de")).toBe("Plan your day");
    expect(pickText({ fr: String.raw`Un\njour calme` }, "de")).toBe("Un jour calme");
  });
  it("cleans existing saved localized text without modifying the input", () => {
    const text = { en: String.raw`Make habits\\nfeel lighter`, de: String.raw`Ein\r\nruhiger Tag` };
    expect(coerceLocalized(text)).toEqual({ en: "Make habits feel lighter", de: "Ein ruhiger Tag" });
    expect(text.en).toBe(String.raw`Make habits\\nfeel lighter`);
  });
  it("cleans legacy text and new edits before they are persisted", () => {
    expect(coerceLocalized(String.raw`Keep your rhythm\nin reach`)).toEqual({ en: "Keep your rhythm in reach" });
    expect(writeLocalized({ de: "Unchanged" }, "en", String.raw`A page for \n every little win`))
      .toEqual({ de: "Unchanged", en: "A page for every little win" });
  });
  it("preserves intentional real line breaks, blank values and unrelated escapes", () => {
    expect(pickText({ en: "Line one\nLine two" }, "en")).toBe("Line one\nLine two");
    expect(writeLocalized({ en: "Text" }, "en", "")).toEqual({});
    expect(coerceLocalized(String.raw`Use \t carefully`)).toEqual({ en: String.raw`Use \t carefully` });
  });
  it("cleans AI/imported headlines and overlay copy on every device without changing assets", () => {
    const project = structuredClone(DEFAULT_PROJECT);
    const slide = project.slidesByDevice.iphone[0];
    slide.headline = { en: String.raw`Calm\nplanning`, de: String.raw`Ruhe\nfinden` };
    slide.textElements = [{ id: "tagline", text: { en: String.raw`One\ncalm place` },
      transform: { x: 10, y: 20, width: 200, height: 80 } }];
    project.slidesByDevice.android[0].label = { en: String.raw`MAKE\nSPACE` };
    const next = normalizeProjectCopy(project);
    expect(next.slidesByDevice.iphone[0].headline).toEqual({ en: "Calm planning", de: "Ruhe finden" });
    expect(next.slidesByDevice.iphone[0].textElements![0].text.en).toBe("One calm place");
    expect(next.slidesByDevice.android[0].label.en).toBe("MAKE SPACE");
    expect(next.slidesByDevice.iphone[0].screenshot).toBe(slide.screenshot);
    expect(next.slidesByDevice.iphone[0].textElements![0].transform).toBe(slide.textElements[0].transform);
    expect(normalizeProjectCopy(next)).toBe(next);
    expect(slide.headline.en).toBe(String.raw`Calm\nplanning`);
  });
  it("migrates escaped text from existing saved projects", () => {
    const project = structuredClone(DEFAULT_PROJECT);
    project.slidesByDevice.iphone[0].headline = { en: String.raw`Notice the days\\nthat shape you` };
    expect(mergeWithDefaults(project).slidesByDevice.iphone[0].headline.en).toBe("Notice the days that shape you");
  });
});
