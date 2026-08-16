import { describe, expect, it } from "vitest";
import { DEFAULT_PROJECT } from "./defaults";
import { createProjectState, clampLocales } from "./project-store";
import { localizeStarterDeck, STARTER_COPY } from "./starter-copy";
import type { Slide } from "./types";

const deck: Slide[] = [
  {
    id: "s1",
    layout: "hero",
    label: { en: "MEET YOUR APP" },
    headline: { en: "Sell one\nidea per slide." },
    screenshot: "",
  },
  {
    id: "s2",
    layout: "device-bottom",
    label: { en: "CUSTOM USER LABEL" },
    headline: { en: "Some user-written headline." },
    screenshot: "",
  },
];

describe("localizeStarterDeck", () => {
  it("writes translations for known starter strings into the chosen locales", () => {
    const [hero] = localizeStarterDeck(deck, ["en", "de", "fr"]);
    expect(hero.label).toEqual({ en: "MEET YOUR APP", de: "LERN DEINE APP KENNEN", fr: "DÉCOUVREZ VOTRE APP" });
    expect(hero.headline).toEqual({
      en: "Sell one\nidea per slide.",
      de: "Eine Idee\npro Bildschirm.",
      fr: "Une idée\npar écran.",
    });
  });

  it("leaves user-written copy untouched", () => {
    const [, custom] = localizeStarterDeck(deck, ["en", "de"]);
    expect(custom.label).toEqual({ en: "CUSTOM USER LABEL" });
    expect(custom.headline).toEqual({ en: "Some user-written headline." });
  });

  it("never writes the en locale via the dictionary", () => {
    const [hero] = localizeStarterDeck(deck, ["en"]);
    expect(hero.label).toEqual({ en: "MEET YOUR APP" });
  });
});

describe("STARTER_COPY", () => {
  it("covers every starter string used by the default decks", () => {
    const allSlides = Object.values(DEFAULT_PROJECT.slidesByDevice).flat();
    for (const slide of allSlides) {
      for (const value of [slide.label?.en, slide.headline?.en]) {
        if (!value) continue;
        expect(STARTER_COPY[value], `missing translation entries for "${value}"`).toBeTruthy();
      }
    }
  });
});

describe("clampLocales", () => {
  it("dedupes and filters invalid codes", () => {
    expect(clampLocales(["de", "de", "en", "nope!"]).sort()).toEqual(["de", "en"]);
  });

  it("falls back to en for empty or missing input", () => {
    expect(clampLocales([])).toEqual(["en"]);
    expect(clampLocales(undefined)).toEqual(["en"]);
  });
});

describe("createProjectState with locales", () => {
  it("sets locales and locale, and localizes the starter decks", () => {
    const project = createProjectState("Multi", ["de", "en"]);
    expect(project.locales).toEqual(["de", "en"]);
    expect(project.locale).toBe("de");
    const firstSlide = project.slidesByDevice.iphone[0];
    expect(firstSlide.label.de).toBeTruthy();
    expect(firstSlide.headline.de).toBeTruthy();
  });

  it("defaults to a single en locale", () => {
    const project = createProjectState("Single");
    expect(project.locales).toEqual(["en"]);
    expect(project.locale).toBe("en");
  });
});
