import { describe, expect, it } from "vitest";
import { zodTextFormat } from "openai/helpers/zod";
import {
  applyDesignProposal,
  designProposalResponseSchema,
  designProposalSchema,
  normalizeDesignResponse,
} from "./design";
import { mergeWithDefaults } from "./storage";
import type { ProjectState, Slide } from "./types";

const slide = (id: string): Slide => ({
  id,
  layout: "hero",
  label: { en: "OLD LABEL", de: "ALTES LABEL" },
  headline: { en: "Old headline", de: "Alte Überschrift" },
  screenshot: `/screenshots/${id}.png`,
});

function project(): ProjectState {
  return {
    schemaVersion: 2,
    appName: "Test App",
    themeId: "clean-light",
    connectedCanvas: true,
    locales: ["en", "de"],
    locale: "en",
    device: "iphone",
    orientation: "portrait",
    slidesByDevice: {
      iphone: [slide("one"), slide("two")],
      ipad: [slide("ipad")],
      android: [],
      "android-7": [],
      "android-10": [],
      "feature-graphic": [],
    },
  };
}

const proposal = {
  summary: "A calmer, more focused direction.",
  targetSlideIds: ["one"],
  theme: {
    id: "calm",
    name: "Calm",
    bg: "#F4F1EA",
    bgAlt: "#151515",
    fg: "#151515",
    fgAlt: "#FFFFFF",
    accent: "#7C8C6B",
    muted: "#737373",
  },
  slidePatches: [
    {
      slideId: "one",
      headline: { en: "New headline" },
      headlineFontFamily: "editorial" as const,
      decorations: [
        {
          id: "orb",
          kind: "ellipse" as const,
          transform: { x: 20, y: 30, width: 200, height: 200, zIndex: 1 },
          fill: { type: "solid" as const, colors: ["#7C8C6B"] },
          opacity: 0.4,
        },
      ],
    },
  ],
};

function assertStrictObjects(node: unknown, path = "$"): void {
  if (!node || typeof node !== "object") return;
  const schema = node as Record<string, unknown>;
  const properties = schema.properties as Record<string, unknown> | undefined;
  if (properties) {
    expect(schema.additionalProperties, `${path} must reject unknown properties`).toBe(false);
    expect(schema.required, `${path} must require every property`).toEqual(
      Object.keys(properties),
    );
    for (const [key, value] of Object.entries(properties)) {
      assertStrictObjects(value, `${path}.properties.${key}`);
    }
  }
  if (schema.items) assertStrictObjects(schema.items, `${path}.items`);
  for (const keyword of ["anyOf", "oneOf"] as const) {
    const branches = schema[keyword];
    if (Array.isArray(branches)) {
      branches.forEach((branch, index) => assertStrictObjects(branch, `${path}.${keyword}[${index}]`));
    }
  }
  const definitions = (schema.$defs || schema.definitions) as Record<string, unknown> | undefined;
  if (definitions) {
    for (const [key, value] of Object.entries(definitions)) {
      assertStrictObjects(value, `${path}.$defs.${key}`);
    }
  }
}

describe("design proposal validation", () => {
  it("generates an OpenAI strict schema with every object field required", () => {
    const format = zodTextFormat(designProposalResponseSchema, "design_test") as unknown as {
      schema: unknown;
    };
    assertStrictObjects(format.schema);
  });

  it("normalizes nullable API fields into an active-locale editor proposal", () => {
    const normalized = normalizeDesignResponse(
      {
        summary: "Simplified hierarchy.",
        targetSlideIds: ["one"],
        theme: null,
        slidePatches: [
          {
            slideId: "one",
            layout: null,
            inverted: null,
            label: null,
            headline: "Neue Überschrift",
            headlineFontFamily: "rounded",
            transforms: null,
            textElements: null,
            decorations: null,
            visualAssetPrompt: null,
            visualAssetOpacity: null,
          },
        ],
        newSlides: [],
      },
      "de",
    );

    expect(normalized.theme).toBeUndefined();
    expect(normalized.slidePatches[0].layout).toBeUndefined();
    expect(normalized.slidePatches[0].headline).toEqual({ de: "Neue Überschrift" });
    expect(normalized.slidePatches[0].headlineFontFamily).toBe("rounded");
  });

  it("normalizes a new screen that uses an attached image", () => {
    const normalized = normalizeDesignResponse(
      {
        summary: "Added a matching workout screen.",
        targetSlideIds: ["one"],
        theme: null,
        slidePatches: [],
        newSlides: [
          {
            sourceReferenceId: "workout-upload",
            insertAfterSlideId: "one",
            layout: "device-bottom",
            inverted: true,
            label: "WORKOUTS",
            headline: "Train with intention",
            headlineFontFamily: "modern",
            transforms: null,
            textElements: [],
            decorations: [],
            visualAssetPrompt: "Midnight energy waves with restrained violet light and negative space.",
            visualAssetOpacity: 0.7,
          },
        ],
      },
      "en",
    );

    expect(normalized.slidePatches).toEqual([]);
    expect(normalized.newSlides?.[0]).toMatchObject({
      sourceReferenceId: "workout-upload",
      insertAfterSlideId: "one",
      headline: { en: "Train with intention" },
      visualAssetOpacity: 0.7,
    });
  });

  it("accepts a bounded editable proposal", () => {
    expect(designProposalSchema.parse(proposal).targetSlideIds).toEqual(["one"]);
  });

  it("rejects a patch outside declared target ids", () => {
    expect(() =>
      designProposalSchema.parse({
        ...proposal,
        slidePatches: [{ ...proposal.slidePatches[0], slideId: "two" }],
      }),
    ).toThrow();
  });

  it("rejects invalid colors and excessive geometry", () => {
    expect(() =>
      designProposalSchema.parse({
        ...proposal,
        theme: { ...proposal.theme, accent: "blue" },
      }),
    ).toThrow();
    expect(() =>
      designProposalSchema.parse({
        ...proposal,
        slidePatches: [
          {
            ...proposal.slidePatches[0],
            decorations: [
              {
                ...proposal.slidePatches[0].decorations[0],
                transform: { x: 0, y: 0, width: 99_999, height: 10 },
              },
            ],
          },
        ],
      }),
    ).toThrow();
  });
});

describe("proposal application", () => {
  it("changes only allowed active-device slides and preserves screenshots/locales", () => {
    const before = project();
    const next = applyDesignProposal(before, proposal, ["one"]);

    expect(next.slidesByDevice.iphone[0].headline).toEqual({
      en: "New headline",
      de: "Alte Überschrift",
    });
    expect(next.slidesByDevice.iphone[0].screenshot).toBe("/screenshots/one.png");
    expect(next.slidesByDevice.iphone[0].headlineFontFamily).toBe("editorial");
    expect(next.slidesByDevice.iphone[1]).toEqual(before.slidesByDevice.iphone[1]);
    expect(next.slidesByDevice.ipad).toEqual(before.slidesByDevice.ipad);
    expect(next.customThemesByDevice?.iphone?.id).toBe("ai-custom-iphone");
    expect(next.customThemesByDevice?.ipad).toBeUndefined();
  });

  it("rejects a proposal outside the UI-selected scope", () => {
    expect(() => applyDesignProposal(project(), proposal, ["two"])).toThrow(
      /outside the selected scope/,
    );
  });

  it("maps a generated visual onto an existing screen without replacing its screenshot", () => {
    const before = project();
    const visualProposal = {
      summary: "Added atmospheric artwork.",
      targetSlideIds: ["one"],
      slidePatches: [
        {
          slideId: "one",
          visualAssetPrompt: "Soft midnight violet motion trails with generous negative space.",
          visualAssetOpacity: 0.68,
        },
      ],
      newSlides: [],
    };
    const next = applyDesignProposal(before, visualProposal, ["one"], [], [
      {
        targetType: "existing",
        targetId: "one",
        path: "/screenshots/generated-ai/midnight.jpg",
      },
    ]);

    expect(next.slidesByDevice.iphone[0].screenshot).toBe("/screenshots/one.png");
    expect(next.slidesByDevice.iphone[0].visualAsset).toEqual({
      src: "/screenshots/generated-ai/midnight.jpg",
      prompt: "Soft midnight violet motion trails with generous negative space.",
      opacity: 0.68,
    });
  });

  it("creates a new screen from a client-supplied slide ID and screenshot path", () => {
    const before = project();
    const createProposal = {
      summary: "Added a matching workout screen.",
      targetSlideIds: ["one"],
      theme: {
        id: "midnight",
        name: "Midnight",
        bg: "#080A12",
        bgAlt: "#11152A",
        fg: "#FFFFFF",
        fgAlt: "#FFFFFF",
        accent: "#7C5CFF",
        muted: "#8E94A8",
      },
      slidePatches: [],
      newSlides: [
        {
          sourceReferenceId: "workout-upload",
          insertAfterSlideId: "one",
          layout: "device-bottom" as const,
          inverted: true,
          label: { en: "WORKOUTS" },
          headline: { en: "Train with intention" },
          headlineFontFamily: "modern" as const,
          textElements: [],
          decorations: [],
        },
      ],
    };
    const next = applyDesignProposal(before, createProposal, ["one"], [
      { slideId: "generated-workout", screenshot: "/screenshots/uploaded/workout.png" },
    ]);

    expect(next.slidesByDevice.iphone).toHaveLength(3);
    expect(next.slidesByDevice.iphone[0]).toEqual(before.slidesByDevice.iphone[0]);
    expect(next.slidesByDevice.iphone[1]).toMatchObject({
      id: "generated-workout",
      screenshot: "/screenshots/uploaded/workout.png",
      headline: { en: "Train with intention" },
    });
    expect(next.slidesByDevice.iphone[2]).toEqual(before.slidesByDevice.iphone[1]);
    expect(next.customThemesByDevice).toBeUndefined();
  });

  it("rejects a new screen when the client did not map its screenshot", () => {
    expect(() =>
      applyDesignProposal(
        project(),
        {
          summary: "Add workout.",
          targetSlideIds: [],
          slidePatches: [],
          newSlides: [
            {
              sourceReferenceId: "workout-upload",
              layout: "hero",
              inverted: false,
              label: { en: "WORKOUT" },
              headline: { en: "Move better" },
              headlineFontFamily: "modern",
              textElements: [],
              decorations: [],
            },
          ],
        },
        [],
      ),
    ).toThrow(/generated slide ID and screenshot asset/);
  });
});

describe("project migration", () => {
  it("upgrades v2 state to v4 without changing existing slide content", () => {
    const before = project();
    const migrated = mergeWithDefaults(before);
    expect(migrated.schemaVersion).toBe(4);
    expect(migrated.slidesByDevice.iphone[0].screenshot).toBe("/screenshots/one.png");
    expect(migrated.slidesByDevice.iphone[0].headline.de).toBe("Alte Überschrift");
  });

  // The sanitizer drops decorations whose `kind` it doesn't recognize, so a
  // new kind that isn't allowlisted there renders once and then silently
  // disappears on the next load. Guard every kind the type permits.
  it("preserves an icon-tile decoration through a sanitize round-trip", () => {
    const before = project();
    before.slidesByDevice.iphone[0].decorations = [
      {
        id: "tile-1",
        kind: "icon-tile",
        transform: { x: 80, y: 120, width: 200, height: 200, rotation: -12 },
        fill: { type: "linear-gradient", colors: ["#A78BFA", "#8B5CF6"], angle: 135 },
        opacity: 1,
        borderRadius: 48,
        iconName: "alarm-clock",
        iconColor: "#FFFFFF",
      },
    ];
    const decorations = mergeWithDefaults(before).slidesByDevice.iphone[0].decorations;
    expect(decorations).toHaveLength(1);
    expect(decorations?.[0].kind).toBe("icon-tile");
    expect(decorations?.[0].iconName).toBe("alarm-clock");
    expect(decorations?.[0].iconColor).toBe("#FFFFFF");
    expect(decorations?.[0].transform.rotation).toBe(-12);
  });

  it("drops an unknown icon name but keeps the tile", () => {
    const before = project();
    before.slidesByDevice.iphone[0].decorations = [
      {
        id: "tile-2",
        kind: "icon-tile",
        transform: { x: 0, y: 0, width: 100, height: 100 },
        fill: { type: "solid", colors: ["#8B5CF6"] },
        opacity: 1,
        iconName: "not-a-real-icon",
      },
    ];
    const decorations = mergeWithDefaults(before).slidesByDevice.iphone[0].decorations;
    expect(decorations).toHaveLength(1);
    expect(decorations?.[0].iconName).toBeUndefined();
  });
});
