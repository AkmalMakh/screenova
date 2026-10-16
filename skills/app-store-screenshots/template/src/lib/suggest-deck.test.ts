import { describe, expect, it } from "vitest";
import { zodTextFormat } from "openai/helpers/zod";
import {
  buildDeckPrompt,
  buildDeckSchema,
  DECK_DEVICE_LAYOUTS,
  DECK_SLIDE_LAYOUTS,
  DECK_THEME_IDS,
  DEFAULT_DECK_COUNT,
  normalizeDeck,
  resolveDeckCount,
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
    backgroundFill: null,
    frameStyle: null,
    headlineStyle: null,
    copy,
    headlineFontFamily: null,
    inverted: null,
    deviceTransform: null,
    captionTransform: null,
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

  it("carries a cloned screen's design detail through", () => {
    const deck = normalizeDeck(
      {
        ...validDeck,
        slides: [
          {
            ...validDeck.slides[0],
            headlineFontFamily: "editorial",
            inverted: true,
            deviceTransform: { x: 160, y: -900, width: 1000, height: 2170, rotation: null, zIndex: 3 },
            textElements: [
              {
                id: "subhead",
                text: { en: "Never forget anything" },
                transform: { x: 120, y: 1500, width: 1080, height: 120, rotation: null, zIndex: null },
                fontSize: 60,
                fontWeight: 700,
                color: "#111111",
                align: "center",
              },
            ],
            decorations: [
              {
                id: "tile",
                kind: "icon-tile",
                transform: { x: 80, y: 1200, width: 200, height: 200, rotation: -12, zIndex: 5 },
                fill: { type: "linear-gradient", colors: ["#A78BFA", "#8B5CF6"], angle: 135 },
                opacity: 1,
                borderRadius: 48,
                blur: null,
                iconName: "alarm-clock",
                iconColor: "#FFFFFF",
              },
            ],
          },
          ...validDeck.slides.slice(1),
        ],
      },
      ["en"],
      5,
    );
    const slide = deck?.slides[0];
    expect(slide?.headlineFontFamily).toBe("editorial");
    expect(slide?.inverted).toBe(true);
    expect(slide?.deviceTransform?.y).toBe(-900);
    expect(slide?.textElements?.[0].text.en).toBe("Never forget anything");
    expect(slide?.textElements?.[0].fontWeight).toBe(700);
    expect(slide?.decorations?.[0].iconName).toBe("alarm-clock");
    expect(slide?.decorations?.[0].transform.rotation).toBe(-12);
  });

  // A headline running underneath a phone is the one defect a user cannot
  // salvage without hand-editing every screen, so it is repaired in code
  // rather than left to the model's arithmetic.
  it("pushes the device below the headline when the model overlaps them", () => {
    const deck = normalizeDeck(
      {
        ...validDeck,
        slides: [
          {
            ...validDeck.slides[0],
            layout: "device-bottom",
            copy: { en: { label: "PLAN", headline: "See your whole month at a glance" } },
            captionTransform: { x: 106, y: 240, width: 1108, height: 800, rotation: null, zIndex: null },
            // Model's placement — lands inside the headline.
            deviceTransform: { x: 105, y: 400, width: 1110, height: 2409, rotation: null, zIndex: 3 },
          },
          ...validDeck.slides.slice(1),
        ],
      },
      ["en"],
      5,
      "iphone",
    );
    const slide = deck?.slides[0];
    // 1320x2868: unit 1320, headline 121.4px over a 1108px box wraps to 2
    // lines, plus the label block and an 86px gap — the device clears ~620.
    expect(slide?.deviceTransform!.y).toBeGreaterThan(600);
    // The text block itself is never moved; only the device yields.
    expect(slide?.captionTransform!.y).toBe(240);
  });

  // Resolving an overlap by shoving the phone off the canvas is not resolving
  // it. When the model puts the caption low, the device has to go up instead.
  it("lifts rather than drops when the text sits at the bottom", () => {
    const deck = normalizeDeck(
      {
        ...validDeck,
        slides: [
          {
            ...validDeck.slides[0],
            layout: "two-devices",
            copy: { en: { label: "SYNC", headline: "Access your day everywhere" } },
            captionTransform: { x: 106, y: 2200, width: 1108, height: 600, rotation: null, zIndex: null },
            deviceTransform: { x: 105, y: 1400, width: 1110, height: 2409, rotation: null, zIndex: 3 },
          },
          ...validDeck.slides.slice(1),
        ],
      },
      ["en"],
      5,
      "iphone",
    );
    const device = deck?.slides[0].deviceTransform!;
    expect(device.y).toBeLessThan(1400);
    // Still substantially on canvas rather than pushed out of frame.
    const visible = Math.min(2868, device.y + device.height) - Math.max(0, device.y);
    expect(visible).toBeGreaterThan(2868 * 0.4);
  });

  it("accounts for rotation, which makes a tilted device reach higher", () => {
    const build = (rotation: number | null) =>
      normalizeDeck(
        {
          ...validDeck,
          slides: [
            {
              ...validDeck.slides[0],
              layout: "device-bottom",
              copy: { en: { label: "PLAN", headline: "See your whole month" } },
              captionTransform: { x: 106, y: 240, width: 1108, height: 800, rotation: null, zIndex: null },
              deviceTransform: { x: 105, y: 400, width: 1110, height: 2409, rotation, zIndex: 3 },
            },
            ...validDeck.slides.slice(1),
          ],
        },
        ["en"],
        5,
        "iphone",
      );
    const upright = build(null)?.slides[0].deviceTransform!.y ?? 0;
    const tilted = build(-15)?.slides[0].deviceTransform!.y ?? 0;
    // A tilted phone's corner reaches above its own y, so it has to be pushed
    // further down than an upright one to clear the same headline.
    expect(tilted).toBeGreaterThan(upright);
  });

  it("leaves a device that already clears the headline alone", () => {
    const deck = normalizeDeck(
      {
        ...validDeck,
        slides: [
          {
            ...validDeck.slides[0],
            layout: "device-bottom",
            copy: { en: { label: "PLAN", headline: "Short one" } },
            captionTransform: { x: 106, y: 240, width: 1108, height: 800, rotation: null, zIndex: null },
            deviceTransform: { x: 105, y: 1600, width: 1110, height: 2409, rotation: null, zIndex: 3 },
          },
          ...validDeck.slides.slice(1),
        ],
      },
      ["en"],
      5,
      "iphone",
    );
    expect(deck?.slides[0].deviceTransform!.y).toBe(1600);
  });

  it("lifts a top-cropped device clear of text sitting below it", () => {
    const deck = normalizeDeck(
      {
        ...validDeck,
        slides: [
          {
            ...validDeck.slides[0],
            layout: "device-top",
            copy: { en: { label: "REMIND", headline: "Schedule reminders" } },
            captionTransform: { x: 106, y: 1800, width: 1108, height: 700, rotation: null, zIndex: null },
            // Bottom edge at 1900, well past where the text starts.
            deviceTransform: { x: 105, y: -500, width: 1110, height: 2400, rotation: null, zIndex: 3 },
          },
          ...validDeck.slides.slice(1),
        ],
      },
      ["en"],
      5,
      "iphone",
    );
    const device = deck?.slides[0].deviceTransform!;
    expect(device.y + device.height).toBeLessThanOrEqual(1800);
  });

  // A template the user can still edit beats refusing the whole deck over one
  // bad widget, so malformed elements are dropped individually.
  it("drops a malformed decoration without losing the screen", () => {
    const deck = normalizeDeck(
      {
        ...validDeck,
        slides: [
          {
            ...validDeck.slides[0],
            decorations: [
              { id: "bad", kind: "hexagon", transform: {}, fill: {}, opacity: 1 },
              {
                id: "good",
                kind: "ellipse",
                transform: { x: 0, y: 0, width: 100, height: 100, rotation: null, zIndex: null },
                fill: { type: "solid", colors: ["#8B5CF6"], angle: null },
                opacity: 0.4,
                borderRadius: null,
                blur: null,
                iconName: null,
                iconColor: null,
              },
            ],
          },
          ...validDeck.slides.slice(1),
        ],
      },
      ["en"],
      5,
    );
    expect(deck).not.toBeNull();
    expect(deck?.slides[0].copy.en.headline).toBe("Build them daily.");
    expect(deck?.slides[0].decorations).toHaveLength(1);
    expect(deck?.slides[0].decorations?.[0].id).toBe("good");
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

describe("resolveDeckCount", () => {
  it("matches the reference deck's screen count", () => {
    expect(resolveDeckCount({ referenceScreenCounts: [7] })).toBe(7);
    expect(resolveDeckCount({ referenceScreenCounts: [10] })).toBe(10);
  });

  it("lets the reference outvote a smaller pile of attached screenshots", () => {
    expect(resolveDeckCount({ screenshotCount: 5, referenceScreenCounts: [7] })).toBe(7);
  });

  it("keeps one screen per screenshot when the user has more than the reference", () => {
    expect(resolveDeckCount({ screenshotCount: 8, referenceScreenCounts: [3] })).toBe(8);
  });

  it("takes the longest of several references", () => {
    expect(resolveDeckCount({ referenceScreenCounts: [3, 7, 5] })).toBe(7);
  });

  it("honors an explicit request over everything else", () => {
    expect(resolveDeckCount({ requested: 4, referenceScreenCounts: [7] })).toBe(4);
  });

  it("clamps to the App Store's 10-screenshot ceiling and the 3-screen floor", () => {
    expect(resolveDeckCount({ referenceScreenCounts: [40] })).toBe(10);
    expect(resolveDeckCount({ screenshotCount: 1 })).toBe(3);
  });

  it("falls back to the default with no signal at all", () => {
    expect(resolveDeckCount({})).toBe(DEFAULT_DECK_COUNT);
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

  it("states the non-overlap rule in real canvas pixels", () => {
    const prompt = buildDeckPrompt(["en"], "iphone", 5);
    // The collision between the headline band and the device is the failure
    // this guidance exists to prevent, so it has to survive prompt edits.
    expect(prompt).toContain("TEXT LAYOUT");
    expect(prompt).toContain("captionTransform");
    expect(prompt).toContain("HARD RULE, text above the device");
    expect(prompt).toContain("HARD RULE, text below the device");
    // 1320x2868 iPhone canvas — budgets must be concrete, not proportional
    // prose the model has to evaluate itself.
    expect(prompt).toContain("1320×2868");
    expect(prompt).toMatch(/gap of at least \d+px/);
    expect(prompt).toContain("at most 2 lines");
  });

  it("scales the layout budgets to the target device", () => {
    const iphone = buildDeckPrompt(["en"], "iphone", 5);
    const android = buildDeckPrompt(["en"], "android", 5);
    expect(iphone).toContain("1320×2868");
    expect(android).toContain("1080×1920");
    expect(iphone).not.toEqual(android);
  });

  it("tells the model what the screens past the last screenshot are for", () => {
    // 5 screenshots against a 7-screen reference: screens 6-7 have no image.
    const prompt = buildDeckPrompt(["en"], "iphone", 7, 5);
    expect(prompt).toContain("Screens 1–5 map to the attached screenshots IN ORDER");
    expect(prompt).toContain("remaining 2 screens");
    expect(prompt).toContain('must use the "no-device" layout');
    expect(prompt).toContain('Do not use "no-device" for screens 1–5');
  });

  it("keeps the strict one-per-screenshot rule when the counts match", () => {
    const prompt = buildDeckPrompt(["en"], "iphone", 5, 5);
    expect(prompt).toContain("exactly one slide per screenshot");
    expect(prompt).not.toContain("remaining");
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

describe("reference framing and creative direction", () => {
  it("retains explicit framing intent through model normalization", () => {
    const deck = normalizeDeck({ appName: "Journal", themeId: "clean-light", theme: THEME, summary: "Reference composition",
      slides: [slide("device-top", { en: { label: "REFLECT", headline: "Find your rhythm" } })],
    }, ["en"], 1, "iphone");
    expect(deck?.slides[0].showDeviceFrame).toBe(true);
  });
  it("prioritizes visible reference geometry without forcing empty-asset slides to lose phones", () => {
    const prompt = buildDeckPrompt(["en"], "iphone", 8, 2, [{ name: "Reference", hasImages: true }]);
    expect(prompt).toContain("retain the reference phone placement");
    expect(prompt).not.toContain('they must use the "no-device" layout');
    expect(prompt).toContain("first reference with attached images");
  });
  it("uses app-specific creativity without pretending to have seen link-only references", () => {
    const prompt = buildDeckPrompt(["en"], "iphone", 5, 0, [{ name: "Website", hasImages: false }]);
    expect(prompt).toContain("APP-SPECIFIC CREATIVE DIRECTION");
    expect(prompt).toContain("its visual appearance is unavailable");
    expect(prompt).not.toContain("Sample this palette FROM THE STYLE REFERENCE screenshots");
  });
});
