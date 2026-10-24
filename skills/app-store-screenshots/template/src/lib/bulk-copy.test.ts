import { describe, expect, it } from "vitest";
import { parseBulkCopy, planBulkCopy, serializeBulkCopy } from "./bulk-copy";
import type { Slide } from "./types";

function slide(id: string, headline: string, subheader?: string): Slide {
  return {
    id,
    layout: "device-bottom",
    label: { en: "LABEL" },
    headline: { en: headline },
    screenshot: "",
    textElements: subheader === undefined
      ? undefined
      : [{
          id: "caption",
          text: { en: subheader },
          transform: { x: 0, y: 0, width: 100, height: 40, rotation: 0, zIndex: 5 },
        }],
  } as Slide;
}

describe("serializeBulkCopy", () => {
  it("writes one row per screen with the current headline and subheader", () => {
    const text = serializeBulkCopy(
      [slide("a", "Sell one\nidea per slide.", "Plans in one place"), slide("b", "Second")],
      "en",
    );
    expect(text).toBe("Sell one idea per slide. | Plans in one place\nSecond |");
  });

  it("round-trips through the parser row for row", () => {
    const slides = [slide("a", "One", "Sub one"), slide("b", "Two"), slide("c", "Three", "Sub three")];
    const pairs = parseBulkCopy(serializeBulkCopy(slides, "en"));
    expect(pairs.map((pair) => pair.headline)).toEqual(["One", "Two", "Three"]);
    expect(pairs[0].subheader).toBe("Sub one");
  });
});

describe("planBulkCopy", () => {
  it("leaves untouched rows alone so headline line breaks survive Apply", () => {
    const slides = [slide("a", "Sell one\nidea per slide.", "Sub"), slide("b", "Old", "Old sub")];
    const edited = serializeBulkCopy(slides, "en").replace("Old | Old sub", "New | New sub");
    const plan = planBulkCopy(slides, parseBulkCopy(edited), "en");
    expect(plan.changed).toBe(1);
    expect(plan.patches.has(0)).toBe(false);
    expect(plan.patches.get(1)?.headline).toEqual({ en: "New" });
    expect(plan.patches.get(1)?.textElements?.[0].text).toEqual({ en: "New sub" });
  });

  it("writes only the edited locale", () => {
    const slides = [{ ...slide("a", "Hello"), headline: { en: "Hello", de: "Hallo" } } as Slide];
    const plan = planBulkCopy(slides, parseBulkCopy("Servus |"), "de");
    expect(plan.patches.get(0)?.headline).toEqual({ en: "Hello", de: "Servus" });
  });
});
