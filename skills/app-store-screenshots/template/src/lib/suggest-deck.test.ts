import { describe, expect, it } from "vitest";
import { zodTextFormat } from "openai/helpers/zod";
import {
  buildDeckPrompt,
  buildDeckSchema,
  DECK_DEVICE_LAYOUTS,
  DECK_SLIDE_LAYOUTS,
  DECK_THEME_IDS,
  normalizeDeck,
} from "./suggest-deck";

const THEME = {
  name: "Test Palette",
  bg: "#FFFFFF",
  bgAlt: "#111111",
  fg: "#111111",
  fgAlt: "#FFFFFF",
  accent: "#5B7CFA",
  muted: "#6B7280",
};

// Structured Outputs requires every property to be present, so the design
// fields are always sent — null and [] are how a screen says "not used".
function slide(layout: string, copy: Record<string, { label: string; headline: string }>) {
  return {
    layout,
    copy,
    headlineFontFamily: null,
    inverted: null,
    deviceTransform: null,
    textElements: [],
    decorations: [],
  };
}

// OpenAI rejects a schema with an optional field, an unbounded record, or a
// missing additionalProperties:false — and the failure only shows up as a live
// 400. Walk the emitted JSON Schema instead. Mirrors design.test.ts.
function assertStrictObjects(node: unknown, path = "$"): void {
  if (!node || typeof node !== "object") return;
  const schema = node as Record<string, unknown>;
  const properties = schema.properties as Record<string, unknown> | undefined;
  if (properties) {
    expect(schema.additionalProperties, `${path} must reject unknown properties`).toBe(false);
    expect(schema.required, `${path} must require every property`).toEqual(Object.keys(properties));
    for (const [key, value] of Object.entries(properties)) {
      assertStrictObjects(value, `${path}.properties.${key}`);
    }
  }
  if (schema.items) assertStrictObjects(schema.items, `${path}.items`);
  for (const keyword of ["anyOf", "oneOf"] as const) {
    const branches = schema[keyword];
    if (Array.isArray(branches)) {
      branches.forEach((branch, index) =>
        assertStrictObjects(branch, `${path}.${keyword}[${index}]`),
      );
    }
  }
  const definitions = (schema.$defs || schema.definitions) as Record<string, unknown> | undefined;
  if (definitions) {
    for (const [key, value] of Object.entries(definitions)) {
      assertStrictObjects(value, `${path}.$defs.${key}`);
    }
  }
}

describe("buildDeckSchema", () => {
  it("builds literal-keyed copy objects for the requested locales", () => {
    const schema = buildDeckSchema(["en", "de"], 5);
    const parsed = schema.safeParse({
      appName: "Streaks",
      themeId: "dark-bold",
      theme: THEME,
      summary: "A bold deck.",
      slides: [
        slide("hero", {
          en: { label: "HABITS", headline: "Build them daily." },
          de: { label: "GEWOHNHEITEN", headline: "Täglich aufbauen." },
        }),
        slide("device-bottom", {
          en: { label: "TRACK", headline: "See your streak." },
          de: { label: "TRACKEN", headline: "Sieh deine Serie." },
        }),
        slide("device-top", {
          en: { label: "SHARE", headline: "With friends." },
          de: { label: "TEILEN", headline: "Mit Freunden." },
        }),
        slide("two-devices", {
          en: { label: "STATS", headline: "Know your data." },
          de: { label: "STATISTIK", headline: "Kenne deine Daten." },
        }),
        slide("no-device", {
          en: { label: "MORE", headline: "And so much more." },
          de: { label: "MEHR", headline: "Und viel mehr." },
        }),
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("emits an OpenAI strict schema with every object field required", () => {
    const format = zodTextFormat(buildDeckSchema(["en", "de"], 3), "deck_test") as unknown as {
      schema: unknown;
    };
    assertStrictObjects(format.schema);
  });

  it("rejects a response with the wrong slide count", () => {
    const schema = buildDeckSchema(["en"], 5);
    const parsed = schema.safeParse({
      appName: "App",
      themeId: "clean-light",
      summary: "Summary",
      slides: [{ layout: "hero", copy: { en: { label: "HI", headline: "Hello." } } }],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects unknown locales, layouts, and themes", () => {
    const schema = buildDeckSchema(["en"], 1);
    const base = {
      appName: "App",
      themeId: "clean-light",
      summary: "Summary",
      slides: [{ layout: "hero", copy: { en: { label: "HI", headline: "Hello." } } }],
    };
    expect(schema.safeParse({ ...base, themeId: "not-a-theme" }).success).toBe(false);
    expect(schema.safeParse({ ...base, slides: [{ layout: "feature-graphic", copy: base.slides[0].copy }] }).success).toBe(false);
    expect(
      schema.safeParse({ ...base, slides: [{ layout: "hero", copy: { fr: { label: "HI", headline: "Hello." } } }] }).success,
    ).toBe(false);
  });
});

describe("normalizeDeck", () => {
  const validDeck = {
    appName: "Streaks",
    themeId: "dark-bold",
    summary: "A bold, dark deck with five screens.",
    slides: [
      { layout: "hero", copy: { en: { label: "HABITS", headline: "Build them daily." } } },
      { layout: "device-bottom", copy: { en: { label: "TRACK", headline: "See your streak." } } },
      { layout: "device-top", copy: { en: { label: "SHARE", headline: "With friends." } } },
      { layout: "two-devices", copy: { en: { label: "STATS", headline: "Know your data." } } },
      { layout: "no-device", copy: { en: { label: "MORE", headline: "And so much more." } } },
    ],
  };

  it("round-trips a valid deck", () => {
    const deck = normalizeDeck(validDeck, ["en"], 5);
    expect(deck).not.toBeNull();
    expect(deck?.appName).toBe("Streaks");
    expect(deck?.themeId).toBe("dark-bold");
    expect(deck?.slides).toHaveLength(5);
    expect(deck?.slides[0].layout).toBe("hero");
    expect(deck?.slides[0].copy.en.headline).toBe("Build them daily.");
  });

  it("falls back to the default theme for an unknown theme id", () => {
    const deck = normalizeDeck({ ...validDeck, themeId: "neon-void" }, ["en"], 5);
    expect(deck?.themeId).toBe("clean-light");
  });

  it("returns null on a slide count mismatch", () => {
    expect(normalizeDeck(validDeck, ["en"], 4)).toBeNull();
  });

  it("returns null when a slide is missing copy for a locale", () => {
    expect(normalizeDeck(validDeck, ["en", "de"], 5)).toBeNull();
  });

  it("returns null on malformed entries", () => {
    expect(normalizeDeck(null, ["en"], 5)).toBeNull();
    expect(normalizeDeck({ ...validDeck, slides: "nope" }, ["en"], 5)).toBeNull();
    expect(
      normalizeDeck({ ...validDeck, slides: [{ layout: "banner", copy: validDeck.slides[0].copy }, ...validDeck.slides.slice(1)] }, ["en"], 5),
    ).toBeNull();
  });

  it("exposes the supported layout and theme lists", () => {
    expect(DECK_SLIDE_LAYOUTS).toContain("hero");
    expect(DECK_THEME_IDS).toContain("clean-light");
    expect(DECK_THEME_IDS).toContain("mote-calendar");
  });
});

describe("screenshot-driven decks", () => {
  it("excludes no-device from the screenshot layout list", () => {
    expect(DECK_DEVICE_LAYOUTS).not.toContain("no-device");
    expect(DECK_DEVICE_LAYOUTS).toContain("two-devices");
  });

  it("rejects no-device layouts when building a screenshot deck schema", () => {
    const schema = buildDeckSchema(["en"], 1, DECK_DEVICE_LAYOUTS);
    const base = {
      appName: "App",
      themeId: "clean-light",
      theme: THEME,
      summary: "Summary",
      slides: [slide("hero", { en: { label: "HI", headline: "Hello." } })],
    };
    expect(schema.safeParse(base).success).toBe(true);
    expect(
      schema.safeParse({
        ...base,
        slides: [slide("no-device", base.slides[0].copy)],
      }).success,
    ).toBe(false);
  });

  it("adds screenshot grounding rules to the prompt when screenshots are attached", () => {
    const withShots = buildDeckPrompt(["en"], "iphone", 3, 3);
    expect(withShots).toContain("attached 3 screenshots");
    expect(withShots).toContain("never \"no-device\"");
    const without = buildDeckPrompt(["en"], "iphone", 5);
    expect(without).not.toContain("screenshots of their app");
    expect(without).toContain("no-device");
  });
});
