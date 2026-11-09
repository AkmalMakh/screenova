import { describe, expect, it } from "vitest";
import { newSlide } from "./defaults";
import { styledLikeDeck } from "./slide-style";
import type { Slide } from "./types";

const reference: Slide = {
  id: "ref",
  layout: "device-top",
  label: { en: "BUDGET" },
  headline: { en: "See what you saved" },
  screenshot: "/screenshots/budget.png",
  screenshotByLocale: { de: "/screenshots/de/budget.png" },
  backgroundFill: { angle: 180, stops: [{ color: "#ffffff", position: 0 }, { color: "#e9ddff", position: 100 }] },
  backgroundStyle: "plain",
  frameStyle: "dark",
  headlineStyle: { fontSize: 120, fontWeight: 700, lineHeight: 1.1, align: "center" },
  headlineFontFamily: "rounded",
  inverted: true,
  transforms: { device: { x: 160, y: -600, width: 1000, height: 2170 }, caption: { x: 110, y: 1900, width: 1100, height: 500 } },
  textElements: [{ id: "subhead", text: { en: "Every won, counted" }, transform: { x: 110, y: 2200, width: 1100, height: 120 } }],
  decorations: [
    { id: "glow", kind: "ellipse", transform: { x: 0, y: 2000, width: 1320, height: 900 }, fill: { type: "solid", colors: ["#dfc9ef"] }, opacity: 0.6 },
    { id: "wallet", kind: "icon-tile", iconName: "wallet", transform: { x: 900, y: 300, width: 180, height: 180 }, fill: { type: "solid", colors: ["#7c5cff"] }, opacity: 1 },
  ],
} as Slide;

describe("a new screen in the deck's style", () => {
  it("takes the look and placement, not the words, screenshots or feature icons", () => {
    const added = newSlide("device-bottom");
    const styled = styledLikeDeck(added, reference);
    expect(styled).toMatchObject({
      id: added.id,
      layout: "device-top",
      label: added.label,
      headline: added.headline,
      screenshot: "",
      backgroundFill: reference.backgroundFill,
      backgroundStyle: "plain",
      frameStyle: "dark",
      headlineStyle: reference.headlineStyle,
      headlineFontFamily: "rounded",
      inverted: true,
      transforms: reference.transforms,
    });
    expect(styled.screenshotByLocale).toBeUndefined();
    expect(styled.textElements).toBeUndefined();
    expect(styled.decorations?.map((decoration) => decoration.kind)).toEqual(["ellipse"]);
    expect(styled.decorations?.[0].id).not.toBe("glow");
  });

  it("keeps a device on screens added after a device-free closer", () => {
    const styled = styledLikeDeck(newSlide("device-bottom"), { ...reference, layout: "no-device" });
    expect(styled.layout).toBe("device-bottom");
    expect(styled.transforms).toBeUndefined();
    expect(styled.frameStyle).toBe("dark");
  });

  it("leaves a starter screen alone when there is nothing to match", () => {
    const added = newSlide();
    expect(styledLikeDeck(added, undefined)).toBe(added);
  });
});
