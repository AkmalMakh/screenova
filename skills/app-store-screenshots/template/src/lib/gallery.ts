import { z } from "zod";
import {
  decorationElementSchema,
  elementTransformSchema,
  headlineFontFamilySchema,
  textElementSchema,
} from "./design";
import { backgroundFillSchema, frameStyleSchema, headlineStyleSchema } from "./slide-appearance";
import type { Device, ProjectState, Slide, Theme } from "./types";

// A gallery post shares a deck's DESIGN, never its owner's app: screenshots,
// the app icon and generated images stay private. Everything that reaches
// another user's editor passes through the allowlists below (unknown keys are
// stripped, colors must be hex), so a post can't smuggle URLs or styles.

export const GALLERY_DEVICES = ["iphone", "ipad", "android", "android-7", "android-10", "feature-graphic"] as const;
export const GALLERY_MAX_SCREENS = 20;
export const GALLERY_MAX_PREVIEWS = 6;
export const GALLERY_MAX_PREVIEW_BYTES = 450_000; // per data URL
export const GALLERY_PREVIEW_PREFIX = "data:image/jpeg;base64,";

const HEX = /^#[0-9a-fA-F]{6}$/;
const LAYOUTS = ["hero", "device-bottom", "device-top", "two-devices", "no-device", "split-landscape", "feature-graphic"] as const;
const localizedText = z.record(z.string().regex(/^[a-z]{2}(-[A-Za-z]{2,4})?$/), z.string().max(240));

const themeSchema = z.object({
  id: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(80),
  bg: z.string().regex(HEX),
  bgAlt: z.string().regex(HEX),
  fg: z.string().regex(HEX),
  fgAlt: z.string().regex(HEX),
  accent: z.string().regex(HEX),
  muted: z.string().regex(HEX),
});

const slideSchema = z.object({
  id: z.string().trim().min(1).max(120),
  layout: z.enum(LAYOUTS),
  label: localizedText,
  headline: localizedText,
  headlineFontFamily: headlineFontFamilySchema.optional(),
  backgroundFill: backgroundFillSchema.optional(),
  frameStyle: frameStyleSchema.optional(),
  headlineStyle: headlineStyleSchema.optional(),
  inverted: z.boolean().optional(),
  backgroundStyle: z.literal("plain").optional(),
  transforms: z
    .object({
      caption: elementTransformSchema.optional(),
      device: elementTransformSchema.optional(),
      deviceSecondary: elementTransformSchema.optional(),
    })
    .optional(),
  textElements: z.array(textElementSchema).max(12).optional(),
  decorations: z.array(decorationElementSchema).max(20).optional(),
});

export type GallerySlide = z.infer<typeof slideSchema>;

export const galleryTemplateSchema = z.object({
  version: z.literal(1),
  device: z.enum(GALLERY_DEVICES),
  orientation: z.enum(["portrait", "landscape"]),
  themeId: z.string().trim().min(1).max(60),
  customTheme: themeSchema.optional(),
  connectedCanvas: z.boolean(),
  locales: z.array(z.string().regex(/^[a-z]{2}(-[A-Za-z]{2,4})?$/)).min(1).max(12),
  locale: z.string().regex(/^[a-z]{2}(-[A-Za-z]{2,4})?$/),
  slides: z.array(slideSchema).min(1).max(GALLERY_MAX_SCREENS),
});
export type GalleryTemplate = z.infer<typeof galleryTemplateSchema>;

export const galleryPublishSchema = z.object({
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().max(280).default(""),
  template: galleryTemplateSchema,
  previews: z
    .array(
      z
        .string()
        .max(GALLERY_MAX_PREVIEW_BYTES)
        .refine((value) => value.startsWith(GALLERY_PREVIEW_PREFIX) && /^[A-Za-z0-9+/]+={0,2}$/.test(value.slice(GALLERY_PREVIEW_PREFIX.length)), "Previews must be JPEG data URLs"),
    )
    .min(1)
    .max(GALLERY_MAX_PREVIEWS),
});
export type GalleryPublishInput = z.infer<typeof galleryPublishSchema>;

/** Card data: safe for anonymous visitors (no owner, no template). */
export type GalleryPostSummary = {
  id: string;
  title: string;
  description: string;
  device: Device;
  screenCount: number;
  previewCount: number;
  createdAt: string;
};

/** Drop anything that fails the allowlist instead of failing the whole deck. */
function cleanSlide(slide: Slide): GallerySlide | null {
  const base = slideSchema.safeParse({
    ...slide,
    textElements: (slide.textElements || []).filter((element) => textElementSchema.safeParse(element).success),
    decorations: (slide.decorations || []).filter((element) => decorationElementSchema.safeParse(element).success),
  });
  return base.success ? base.data : null;
}

/**
 * The shareable design of the active device's deck. Screenshots, the app icon,
 * generated visual assets and workspace-only canvas offsets are left out.
 */
export function toGalleryTemplate(project: ProjectState): GalleryTemplate {
  const slides = (project.slidesByDevice[project.device] || [])
    .slice(0, GALLERY_MAX_SCREENS)
    .map(cleanSlide)
    .filter((slide): slide is GallerySlide => slide !== null);
  const theme = project.customThemesByDevice?.[project.device] || project.customTheme;
  const parsedTheme = theme ? themeSchema.safeParse(theme) : null;
  return galleryTemplateSchema.parse({
    version: 1,
    device: project.device,
    orientation: project.orientation,
    themeId: project.themeId,
    ...(parsedTheme?.success ? { customTheme: parsedTheme.data } : {}),
    connectedCanvas: !!project.connectedCanvas,
    locales: project.locales,
    locale: project.locales.includes(project.locale) ? project.locale : project.locales[0],
    slides,
  });
}

/** Template slides as editor slides: fresh IDs and empty screenshot slots. */
export function slidesFromTemplate(template: GalleryTemplate, makeId: () => string): Slide[] {
  return template.slides.map((slide) => ({
    ...(slide as Omit<Slide, "screenshot">),
    id: makeId(),
    screenshot: "",
  }));
}

export function themeFromTemplate(template: GalleryTemplate): Theme | undefined {
  return template.customTheme
    ? { ...template.customTheme, id: `gallery-${template.device}` }
    : undefined;
}

/** Where a signed-out visitor's "Use this template" choice waits for sign-in. */
export const PENDING_TEMPLATE_KEY = "screenova.pendingGalleryTemplate";
