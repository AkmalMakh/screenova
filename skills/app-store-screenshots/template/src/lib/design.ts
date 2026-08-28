import { z } from "zod";
import type {
  DecorationElement,
  ElementTransform,
  LocalizedText,
  ProjectState,
  Slide,
  SlideLayout,
  TextElement,
  Theme,
} from "./types";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const MAX_COORDINATE = 20_000;
const headlineFontFamilySchema = z.enum([
  "modern",
  "editorial",
  "geometric",
  "rounded",
  "mono",
]);

const localizedTextSchema = z.record(z.string(), z.string().max(240));

export const elementTransformSchema = z.object({
  x: z.number().finite().min(-MAX_COORDINATE).max(MAX_COORDINATE),
  y: z.number().finite().min(-MAX_COORDINATE).max(MAX_COORDINATE),
  width: z.number().finite().min(1).max(MAX_COORDINATE),
  height: z.number().finite().min(1).max(MAX_COORDINATE),
  rotation: z.number().finite().min(-180).max(180).optional(),
  zIndex: z.number().int().min(0).max(100).optional(),
});

export const textElementSchema = z.object({
  id: z.string().trim().min(1).max(80),
  text: localizedTextSchema,
  transform: elementTransformSchema,
  fontSize: z.number().finite().min(12).max(400).optional(),
  fontWeight: z.number().int().min(100).max(900).optional(),
  color: z.string().regex(HEX_COLOR).optional(),
  align: z.enum(["left", "center", "right"]).optional(),
});

export const decorationElementSchema = z.object({
  id: z.string().trim().min(1).max(80),
  kind: z.enum(["ellipse", "rounded-rectangle", "line"]),
  transform: elementTransformSchema,
  fill: z.object({
    type: z.enum(["solid", "linear-gradient"]),
    colors: z.array(z.string().regex(HEX_COLOR)).min(1).max(3),
    angle: z.number().finite().min(0).max(360).optional(),
  }),
  opacity: z.number().finite().min(0.05).max(1),
  borderRadius: z.number().finite().min(0).max(1000).optional(),
  blur: z.number().finite().min(0).max(80).optional(),
});

const themeSchema = z.object({
  id: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(80),
  bg: z.string().regex(HEX_COLOR),
  bgAlt: z.string().regex(HEX_COLOR),
  fg: z.string().regex(HEX_COLOR),
  fgAlt: z.string().regex(HEX_COLOR),
  accent: z.string().regex(HEX_COLOR),
  muted: z.string().regex(HEX_COLOR),
});

// OpenAI Structured Outputs requires every object property to be present.
// Nullable fields represent "no change" and are normalized into the editor's
// optional-field proposal shape after the response is parsed.
export const responseElementTransformSchema = z.object({
  x: z.number().finite().min(-MAX_COORDINATE).max(MAX_COORDINATE),
  y: z.number().finite().min(-MAX_COORDINATE).max(MAX_COORDINATE),
  width: z.number().finite().min(1).max(MAX_COORDINATE),
  height: z.number().finite().min(1).max(MAX_COORDINATE),
  rotation: z.number().finite().min(-180).max(180).nullable(),
  zIndex: z.number().int().min(0).max(100).nullable(),
});

export const responseTextElementSchema = z.object({
  id: z.string().trim().min(1).max(80),
  text: z.string().max(240),
  transform: responseElementTransformSchema,
  fontSize: z.number().finite().min(12).max(400).nullable(),
  fontWeight: z.number().int().min(100).max(900).nullable(),
  color: z.string().regex(HEX_COLOR).nullable(),
  align: z.enum(["left", "center", "right"]).nullable(),
});

export const responseDecorationElementSchema = z.object({
  id: z.string().trim().min(1).max(80),
  kind: z.enum(["ellipse", "rounded-rectangle", "line"]),
  transform: responseElementTransformSchema,
  fill: z.object({
    type: z.enum(["solid", "linear-gradient"]),
    colors: z.array(z.string().regex(HEX_COLOR)).min(1).max(3),
    angle: z.number().finite().min(0).max(360).nullable(),
  }),
  opacity: z.number().finite().min(0.05).max(1),
  borderRadius: z.number().finite().min(0).max(1000).nullable(),
  blur: z.number().finite().min(0).max(80).nullable(),
});

const responseBuiltInTransformsSchema = z.object({
  caption: responseElementTransformSchema.nullable(),
  device: responseElementTransformSchema.nullable(),
  deviceSecondary: responseElementTransformSchema.nullable(),
});

const responseSlidePatchSchema = z.object({
  slideId: z.string().trim().min(1).max(120),
  layout: z
    .enum([
      "hero",
      "device-bottom",
      "device-top",
      "two-devices",
      "no-device",
      "split-landscape",
      "feature-graphic",
    ])
    .nullable(),
  inverted: z.boolean().nullable(),
  label: z.string().max(240).nullable(),
  headline: z.string().max(240).nullable(),
  headlineFontFamily: headlineFontFamilySchema.nullable(),
  transforms: responseBuiltInTransformsSchema.nullable(),
  textElements: z.array(responseTextElementSchema).max(12).nullable(),
  decorations: z.array(responseDecorationElementSchema).max(20).nullable(),
  visualAssetPrompt: z.string().trim().min(1).max(1_200).nullable(),
  visualAssetOpacity: z.number().finite().min(0.05).max(1).nullable(),
});

const responseNewSlideSchema = z.object({
  sourceReferenceId: z.string().trim().min(1).max(120),
  insertAfterSlideId: z.string().trim().min(1).max(120).nullable(),
  layout: z.enum([
    "hero",
    "device-bottom",
    "device-top",
    "two-devices",
    "no-device",
    "split-landscape",
    "feature-graphic",
  ]),
  inverted: z.boolean(),
  label: z.string().max(240),
  headline: z.string().max(240),
  headlineFontFamily: headlineFontFamilySchema,
  transforms: responseBuiltInTransformsSchema.nullable(),
  textElements: z.array(responseTextElementSchema).max(12),
  decorations: z.array(responseDecorationElementSchema).max(20),
  visualAssetPrompt: z.string().trim().min(1).max(1_200).nullable(),
  visualAssetOpacity: z.number().finite().min(0.05).max(1).nullable(),
});

export const designProposalResponseSchema = z.object({
  summary: z.string().trim().min(1).max(800),
  targetSlideIds: z.array(z.string().trim().min(1).max(120)).max(20),
  theme: themeSchema.nullable(),
  slidePatches: z.array(responseSlidePatchSchema).max(20),
  newSlides: z.array(responseNewSlideSchema).max(10),
});

const builtInTransformsSchema = z.object({
  caption: elementTransformSchema.optional(),
  device: elementTransformSchema.optional(),
  deviceSecondary: elementTransformSchema.optional(),
});

const slidePatchSchema = z.object({
  slideId: z.string().trim().min(1).max(120),
  layout: z
    .enum([
      "hero",
      "device-bottom",
      "device-top",
      "two-devices",
      "no-device",
      "split-landscape",
      "feature-graphic",
    ])
    .optional(),
  inverted: z.boolean().optional(),
  label: localizedTextSchema.optional(),
  headline: localizedTextSchema.optional(),
  headlineFontFamily: headlineFontFamilySchema.optional(),
  transforms: builtInTransformsSchema.optional(),
  textElements: z.array(textElementSchema).max(12).optional(),
  decorations: z.array(decorationElementSchema).max(20).optional(),
  visualAssetPrompt: z.string().trim().min(1).max(1_200).optional(),
  visualAssetOpacity: z.number().finite().min(0.05).max(1).optional(),
});

const newSlideSchema = z.object({
  sourceReferenceId: z.string().trim().min(1).max(120),
  insertAfterSlideId: z.string().trim().min(1).max(120).optional(),
  layout: z.enum([
    "hero",
    "device-bottom",
    "device-top",
    "two-devices",
    "no-device",
    "split-landscape",
    "feature-graphic",
  ]),
  inverted: z.boolean(),
  label: localizedTextSchema,
  headline: localizedTextSchema,
  headlineFontFamily: headlineFontFamilySchema,
  transforms: builtInTransformsSchema.optional(),
  textElements: z.array(textElementSchema).max(12),
  decorations: z.array(decorationElementSchema).max(20),
  visualAssetPrompt: z.string().trim().min(1).max(1_200).optional(),
  visualAssetOpacity: z.number().finite().min(0.05).max(1).optional(),
});

export const designProposalSchema = z
  .object({
    summary: z.string().trim().min(1).max(800),
    targetSlideIds: z.array(z.string().trim().min(1).max(120)).max(20),
    theme: themeSchema.optional(),
    slidePatches: z.array(slidePatchSchema).max(20),
    newSlides: z.array(newSlideSchema).max(10).optional(),
  })
  .superRefine((proposal, context) => {
    if (proposal.slidePatches.length === 0 && (proposal.newSlides || []).length === 0) {
      context.addIssue({ code: "custom", message: "Proposal contains no slide changes" });
    }
    const targetIds = new Set(proposal.targetSlideIds);
    if (targetIds.size !== proposal.targetSlideIds.length) {
      context.addIssue({ code: "custom", message: "targetSlideIds contains duplicates" });
    }
    const patchedIds = new Set<string>();
    for (const patch of proposal.slidePatches) {
      if (!targetIds.has(patch.slideId)) {
        context.addIssue({
          code: "custom",
          message: `Patch targets undeclared slide ${patch.slideId}`,
        });
      }
      if (patchedIds.has(patch.slideId)) {
        context.addIssue({ code: "custom", message: `Duplicate patch for ${patch.slideId}` });
      }
      patchedIds.add(patch.slideId);
      const elementIds = [
        ...(patch.textElements || []).map((element) => `text:${element.id}`),
        ...(patch.decorations || []).map((element) => `decoration:${element.id}`),
      ];
      if (new Set(elementIds).size !== elementIds.length) {
        context.addIssue({
          code: "custom",
          message: `Duplicate element id in slide ${patch.slideId}`,
        });
      }
    }
    for (const newSlide of proposal.newSlides || []) {
      if (newSlide.insertAfterSlideId && !targetIds.has(newSlide.insertAfterSlideId)) {
        context.addIssue({
          code: "custom",
          message: `New slide insertion target is outside the declared scope: ${newSlide.insertAfterSlideId}`,
        });
      }
    }
    const visualAssetCount =
      proposal.slidePatches.filter((patch) => !!patch.visualAssetPrompt).length +
      (proposal.newSlides || []).filter((slide) => !!slide.visualAssetPrompt).length;
    if (visualAssetCount > 3) {
      context.addIssue({ code: "custom", message: "A proposal can generate at most 3 visual assets" });
    }
  });

export type DesignProposal = z.infer<typeof designProposalSchema>;
export type GeneratedVisualAsset =
  | { targetType: "existing"; targetId: string; path: string }
  | { targetType: "new"; targetIndex: number; path: string };
export type DesignScope = "current" | "selected" | "deck";

export type DesignConversationMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: number;
  proposalStatus?: "pending" | "applied" | "discarded" | "failed";
  referenceIds?: string[];
  referenceNames?: string[];
};

export type DesignReference = {
  id: string;
  name: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  dataUrl: string;
};

export type DesignRequest = {
  prompt: string;
  scope: { type: DesignScope; slideIds: string[] };
  project: ProjectState;
  renderedPreviews: Array<{ slideId: string; dataUrl: string }>;
  references: Array<{ id: string; name: string; mimeType: string; dataUrl: string }>;
  conversation: Array<{ role: "user" | "assistant"; text: string }>;
};

export function parseDesignProposal(input: unknown): DesignProposal {
  return designProposalSchema.parse(input);
}

export function normalizeDesignResponse(input: unknown, locale: string): DesignProposal {
  const response = designProposalResponseSchema.parse(input);
  const localeKey = locale || "en";
  return designProposalSchema.parse({
    summary: response.summary,
    targetSlideIds: response.targetSlideIds,
    ...(response.theme ? { theme: response.theme } : {}),
    slidePatches: response.slidePatches.map((patch) => ({
      slideId: patch.slideId,
      ...(patch.layout !== null ? { layout: patch.layout } : {}),
      ...(patch.inverted !== null ? { inverted: patch.inverted } : {}),
      ...(patch.label !== null ? { label: { [localeKey]: patch.label } } : {}),
      ...(patch.headline !== null ? { headline: { [localeKey]: patch.headline } } : {}),
      ...(patch.headlineFontFamily !== null
        ? { headlineFontFamily: patch.headlineFontFamily }
        : {}),
      ...(patch.transforms !== null
        ? { transforms: normalizeResponseTransforms(patch.transforms) }
        : {}),
      ...(patch.textElements !== null
        ? {
            textElements: patch.textElements.map((element) =>
              normalizeResponseTextElement(element, localeKey),
            ),
          }
        : {}),
      ...(patch.decorations !== null
        ? { decorations: patch.decorations.map(normalizeResponseDecoration) }
        : {}),
      ...(patch.visualAssetPrompt !== null
        ? { visualAssetPrompt: patch.visualAssetPrompt }
        : {}),
      ...(patch.visualAssetOpacity !== null
        ? { visualAssetOpacity: patch.visualAssetOpacity }
        : {}),
    })),
    newSlides: response.newSlides.map((slide) => ({
      sourceReferenceId: slide.sourceReferenceId,
      ...(slide.insertAfterSlideId !== null
        ? { insertAfterSlideId: slide.insertAfterSlideId }
        : {}),
      layout: slide.layout,
      inverted: slide.inverted,
      label: { [localeKey]: slide.label },
      headline: { [localeKey]: slide.headline },
      headlineFontFamily: slide.headlineFontFamily,
      ...(slide.transforms !== null
        ? { transforms: normalizeResponseTransforms(slide.transforms) }
        : {}),
      textElements: slide.textElements.map((element) =>
        normalizeResponseTextElement(element, localeKey),
      ),
      decorations: slide.decorations.map(normalizeResponseDecoration),
      ...(slide.visualAssetPrompt !== null
        ? { visualAssetPrompt: slide.visualAssetPrompt }
        : {}),
      ...(slide.visualAssetOpacity !== null
        ? { visualAssetOpacity: slide.visualAssetOpacity }
        : {}),
    })),
  });
}

export function normalizeResponseTransform(
  transform: z.infer<typeof responseElementTransformSchema>,
): ElementTransform {
  return {
    x: transform.x,
    y: transform.y,
    width: transform.width,
    height: transform.height,
    ...(transform.rotation !== null ? { rotation: transform.rotation } : {}),
    ...(transform.zIndex !== null ? { zIndex: transform.zIndex } : {}),
  };
}

/** Drop the null (= "no change") entries from a built-in transform map. */
function normalizeResponseTransforms(
  transforms: z.infer<typeof responseBuiltInTransformsSchema>,
): Record<string, ElementTransform> {
  return Object.fromEntries(
    Object.entries(transforms)
      .filter((entry): entry is [string, NonNullable<(typeof entry)[1]>] => entry[1] !== null)
      .map(([key, transform]) => [key, normalizeResponseTransform(transform)]),
  );
}

// The model returns one string per text element because /api/design edits a
// single locale at a time; the caller's active locale becomes the only key.
// Other locales survive via the merge in applySlidePatch.
export function normalizeResponseTextElement(
  element: z.infer<typeof responseTextElementSchema>,
  localeKey: string,
): TextElement {
  return {
    id: element.id,
    text: { [localeKey]: element.text },
    transform: normalizeResponseTransform(element.transform),
    ...(element.fontSize !== null ? { fontSize: element.fontSize } : {}),
    ...(element.fontWeight !== null ? { fontWeight: element.fontWeight } : {}),
    ...(element.color !== null ? { color: element.color } : {}),
    ...(element.align !== null ? { align: element.align } : {}),
  };
}

// Decorations carry no localized content, so this needs no locale.
export function normalizeResponseDecoration(
  element: z.infer<typeof responseDecorationElementSchema>,
): DecorationElement {
  return {
    id: element.id,
    kind: element.kind,
    transform: normalizeResponseTransform(element.transform),
    fill: {
      type: element.fill.type,
      colors: element.fill.colors,
      ...(element.fill.angle !== null ? { angle: element.fill.angle } : {}),
    },
    opacity: element.opacity,
    ...(element.borderRadius !== null ? { borderRadius: element.borderRadius } : {}),
    ...(element.blur !== null ? { blur: element.blur } : {}),
  };
}

export function applyDesignProposal(
  project: ProjectState,
  proposalInput: unknown,
  allowedSlideIds: readonly string[],
  newSlideAssets: readonly { slideId: string; screenshot: string }[] = [],
  generatedVisualAssets: readonly GeneratedVisualAsset[] = [],
): ProjectState {
  const proposal = parseDesignProposal(proposalInput);
  const allowed = new Set(allowedSlideIds);
  const currentSlides = project.slidesByDevice[project.device] || [];
  const existingIds = new Set(currentSlides.map((slide) => slide.id));

  for (const id of proposal.targetSlideIds) {
    if (!allowed.has(id) || !existingIds.has(id)) {
      throw new Error(`Proposal targets a slide outside the selected scope: ${id}`);
    }
  }

  const requestedNewSlides = proposal.newSlides || [];
  if (newSlideAssets.length !== requestedNewSlides.length) {
    throw new Error("Every new screen must have a generated slide ID and screenshot asset.");
  }
  const generatedIds = new Set(newSlideAssets.map((asset) => asset.slideId));
  if (
    generatedIds.size !== newSlideAssets.length ||
    newSlideAssets.some((asset) => existingIds.has(asset.slideId) || !asset.screenshot)
  ) {
    throw new Error("New screen assets contain an invalid or duplicate slide ID.");
  }

  const expectedVisualKeys = new Set([
    ...proposal.slidePatches
      .filter((patch) => !!patch.visualAssetPrompt)
      .map((patch) => `existing:${patch.slideId}`),
    ...requestedNewSlides.flatMap((slide, index) =>
      slide.visualAssetPrompt ? [`new:${index}`] : [],
    ),
  ]);
  const visualAssetsByKey = new Map<string, string>();
  for (const asset of generatedVisualAssets) {
    const key =
      asset.targetType === "existing"
        ? `existing:${asset.targetId}`
        : `new:${asset.targetIndex}`;
    if (!expectedVisualKeys.has(key) || visualAssetsByKey.has(key) || !asset.path) {
      throw new Error("Generated visual assets do not match the design proposal.");
    }
    visualAssetsByKey.set(key, asset.path);
  }
  if (visualAssetsByKey.size !== expectedVisualKeys.size) {
    throw new Error("Every requested visual asset must have a generated image path.");
  }

  const patchById = new Map(proposal.slidePatches.map((patch) => [patch.slideId, patch]));
  const slides = currentSlides.map((slide) => {
    const patch = patchById.get(slide.id);
    if (!patch) return slide;
    return applySlidePatch(
      slide,
      patch,
      visualAssetsByKey.get(`existing:${patch.slideId}`),
    );
  });

  const insertionTails = new Map<string, string>();
  for (const [index, spec] of requestedNewSlides.entries()) {
    const asset = newSlideAssets[index];
    const newSlide: Slide = {
      id: asset.slideId,
      layout: spec.layout,
      label: spec.label,
      headline: spec.headline,
      headlineFontFamily: spec.headlineFontFamily,
      screenshot: asset.screenshot,
      inverted: spec.inverted,
      ...(spec.transforms ? { transforms: spec.transforms } : {}),
      textElements: spec.textElements,
      decorations: spec.decorations,
      ...(spec.visualAssetPrompt
        ? {
            visualAsset: {
              src: visualAssetsByKey.get(`new:${index}`)!,
              prompt: spec.visualAssetPrompt,
              opacity: spec.visualAssetOpacity ?? 0.72,
            },
          }
        : {}),
    };
    const insertionAnchor = spec.insertAfterSlideId
      ? insertionTails.get(spec.insertAfterSlideId) || spec.insertAfterSlideId
      : undefined;
    const anchorIndex = insertionAnchor
      ? slides.findIndex((slide) => slide.id === insertionAnchor)
      : -1;
    if (anchorIndex >= 0) {
      slides.splice(anchorIndex + 1, 0, newSlide);
      if (spec.insertAfterSlideId) insertionTails.set(spec.insertAfterSlideId, newSlide.id);
    } else {
      slides.push(newSlide);
    }
  }

  const appliedTheme = proposal.slidePatches.length > 0 ? proposal.theme : undefined;
  const customTheme: Theme | undefined = appliedTheme
    ? {
        ...appliedTheme,
        id: `ai-custom-${project.device}`,
        name: appliedTheme.name || "AI Custom",
      }
    : project.customThemesByDevice?.[project.device];

  return {
    ...project,
    ...(appliedTheme
      ? {
          customThemesByDevice: {
            ...(project.customThemesByDevice || {}),
            [project.device]: customTheme,
          },
        }
      : {}),
    slidesByDevice: {
      ...project.slidesByDevice,
      [project.device]: slides,
    },
  };
}

function applySlidePatch(
  slide: Slide,
  patch: DesignProposal["slidePatches"][number],
  generatedVisualAssetPath?: string,
): Slide {
  return {
    ...slide,
    ...(patch.layout ? { layout: patch.layout as SlideLayout } : {}),
    ...(typeof patch.inverted === "boolean" ? { inverted: patch.inverted } : {}),
    ...(patch.label ? { label: { ...slide.label, ...(patch.label as LocalizedText) } } : {}),
    ...(patch.headline
      ? { headline: { ...slide.headline, ...(patch.headline as LocalizedText) } }
      : {}),
    ...(patch.headlineFontFamily
      ? { headlineFontFamily: patch.headlineFontFamily }
      : {}),
    ...(patch.transforms ? { transforms: patch.transforms as Slide["transforms"] } : {}),
    ...(patch.textElements
      ? {
          textElements: (patch.textElements as TextElement[]).map((element) => {
            const existing = slide.textElements?.find((item) => item.id === element.id);
            return existing
              ? { ...element, text: { ...existing.text, ...element.text } }
              : element;
          }),
        }
      : {}),
    ...(patch.decorations ? { decorations: patch.decorations as DecorationElement[] } : {}),
    ...(patch.visualAssetPrompt && generatedVisualAssetPath
      ? {
          visualAsset: {
            src: generatedVisualAssetPath,
            prompt: patch.visualAssetPrompt,
            opacity: patch.visualAssetOpacity ?? 0.72,
          },
        }
      : {}),
    // App screenshots and their locale mappings are intentionally inherited.
    screenshot: slide.screenshot,
    screenshotSecondary: slide.screenshotSecondary,
    screenshotByLocale: slide.screenshotByLocale,
    screenshotSecondaryByLocale: slide.screenshotSecondaryByLocale,
  };
}

export function proposalSummary(proposal: DesignProposal): string {
  const screenCount = new Set(proposal.targetSlideIds).size;
  const newScreenCount = proposal.newSlides?.length || 0;
  const visualAssetCount =
    proposal.slidePatches.filter((patch) => !!patch.visualAssetPrompt).length +
    (proposal.newSlides || []).filter((slide) => !!slide.visualAssetPrompt).length;
  const changes = [
    screenCount ? `${screenCount} redesigned screen${screenCount === 1 ? "" : "s"}` : null,
    newScreenCount ? `${newScreenCount} new screen${newScreenCount === 1 ? "" : "s"}` : null,
    proposal.theme ? "new color system" : null,
    proposal.slidePatches.some((patch) => patch.decorations?.length) ? "editable decorations" : null,
    visualAssetCount ? `${visualAssetCount} generated visual asset${visualAssetCount === 1 ? "" : "s"}` : null,
  ].filter(Boolean);
  return `${proposal.summary}\n\nChanged: ${changes.join(", ")}.`;
}

export function cloneProject(state: ProjectState): ProjectState {
  return JSON.parse(JSON.stringify(state)) as ProjectState;
}

export type { ElementTransform, Theme };
