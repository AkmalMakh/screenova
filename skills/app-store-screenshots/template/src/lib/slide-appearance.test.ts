import { expect, it } from "vitest";
import { backgroundFillCss, backgroundFillSchema } from "./slide-appearance";
import { buildSuggestedSlides } from "./import-slides";

it("keeps the white upper area and lower pastel gradient stops without recoloring them", () => {
  const fill = { angle: 165, stops: [{ color: "#f9f9fa", position: 0 }, { color: "#f9f9fa", position: 45 }, { color: "#f2c9eb", position: 100 }] };
  expect(backgroundFillSchema.parse(fill)).toEqual(fill);
  expect(backgroundFillCss(fill)).toBe("linear-gradient(165deg, #f9f9fa 0%, #f9f9fa 45%, #f2c9eb 100%)");
  const headlineStyle = { fontSize: 96, fontWeight: 600, lineHeight: 1.15, align: "center" as const };
  const [slide] = buildSuggestedSlides([{ layout: "device-bottom", showDeviceFrame: true, frameStyle: "white", backgroundFill: fill, headlineStyle,
    copy: { en: { label: "", headline: "Make space for your habits" } }, decorations: [],
  }], [], ["en"], "iphone");
  expect(slide.backgroundFill).toEqual(fill);
  expect(slide.frameStyle).toBe("white");
  expect(slide.headlineStyle).toEqual(headlineStyle);
  expect(slide.label).toEqual({});
  expect(slide.decorations).toBeUndefined();
});

it("rejects invalid gradient colors and positions", () => {
  expect(backgroundFillSchema.safeParse({ angle: 180, stops: [{ color: "url(x)", position: 0 }, { color: "#ffffff", position: 101 }] }).success).toBe(false);
});
