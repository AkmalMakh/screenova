import { describe, expect, it } from "vitest";
import { badgeText, cleanAwardBadge, createAwardBadge } from "./award-badge";
import { decorationElementSchema } from "./design";
import { DEFAULT_PROJECT } from "./defaults";
import { mergeWithDefaults } from "./storage";

describe("editable award badges", () => {
  it("creates a transparent, foreground badge fitting portrait and banner canvases", () => {
    for (const [width, height] of [[1320, 2868], [1024, 500]]) {
      const element = createAwardBadge("award", "de", width, height, 8);
      expect(element.kind).toBe("award-badge");
      expect(element.transform.width / element.transform.height).toBe(2);
      expect(element.transform.x + element.transform.width).toBeLessThanOrEqual(width);
      expect(element.transform.y + element.transform.height).toBeLessThanOrEqual(height);
      expect(element.transform.zIndex).toBe(8);
      expect(element.badge?.title.de).toBe("App Store");
      expect(decorationElementSchema.parse(element)).toEqual(element);
    }
  });
  it("keeps copy, colors, and transforms through hydration", () => {
    const project = structuredClone(DEFAULT_PROJECT);
    const element = createAwardBadge("award", "en", 1320, 2868, 8);
    element.badge = { eyebrow: { en: "2024", de: "" }, title: { en: "App Store", de: "Auszeichnung" }, stars: 3, laurels: false, textColor: "#AA2233" };
    element.transform.rotation = 15;
    project.slidesByDevice.iphone[0].decorations = [element];
    expect(mergeWithDefaults(JSON.parse(JSON.stringify(project))).slidesByDevice.iphone[0].decorations).toEqual([element]);
  });
  it("sanitizes malformed fields without losing the badge", () => {
    expect(cleanAwardBadge({ title: { en: "hello\\nworld", de: 123 }, stars: 99, laurels: "false", textColor: "url(secret)" })).toMatchObject({
      title: { en: "hello world" }, stars: 5, laurels: true, textColor: "#131316",
    });
    expect(cleanAwardBadge({ stars: NaN }).stars).toBe(5);
    expect(cleanAwardBadge({ stars: -5 }).stars).toBe(0);
    expect(cleanAwardBadge({ title: { en: "x".repeat(500) } }).title.en).toHaveLength(64);
  });
  it("supports explicit hidden lines and locale fallback", () => {
    expect(badgeText({ en: "2024", de: "" }, "de")).toBe("");
    expect(badgeText({ en: "App Store" }, "fr")).toBe("App Store");
    expect(badgeText({ en: "App\\nStore" }, "de")).toBe("App Store");
  });
});
