import { z } from "zod";
import { coerceLocalized, pickText } from "./locale";
import type { AwardBadge, DecorationElement, LocalizedText } from "./types";

export const AWARD_BADGE_PRESETS = [
  { id: "classic", name: { en: "Classic", de: "Klassisch", es: "Clásico", fr: "Classique" }, color: "#131316", background: "#FCE3A6" },
  { id: "white", name: { en: "White", de: "Weiß", es: "Blanco", fr: "Blanc" }, color: "#FFFFFF", background: "#442572" },
  { id: "gold", name: { en: "Gold", de: "Gold", es: "Dorado", fr: "Doré" }, color: "#F4CE78", background: "#1C1C1E" },
] as const;
export type AwardBadgePreset = typeof AWARD_BADGE_PRESETS[number];

export function presetBadge(preset: AwardBadgePreset, locale: string): AwardBadge {
  return { eyebrow: { [locale]: String(new Date().getFullYear()) }, title: { [locale]: "App Store" }, stars: 5, laurels: true, textColor: preset.color };
}

export const awardBadgeSchema = z.object({
  eyebrow: z.record(z.string(), z.string().max(64)),
  title: z.record(z.string(), z.string().max(64)),
  stars: z.number().int().min(0).max(5),
  laurels: z.boolean(),
  textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export function cleanAwardBadge(value: unknown): AwardBadge {
  const raw = (value && typeof value === "object" ? value : {}) as Partial<AwardBadge>;
  const copy = (value: unknown, fallback: LocalizedText) => {
    const localized = value === undefined ? fallback : coerceLocalized(value);
    return Object.fromEntries(Object.entries(localized).map(([key, text]) => [key, text!.slice(0, 64)]));
  };
  return {
    eyebrow: copy(raw.eyebrow, { en: "YOUR YEAR" }),
    title: copy(raw.title, { en: "Your award" }),
    stars: typeof raw.stars === "number" && Number.isFinite(raw.stars)
      ? Math.max(0, Math.min(5, Math.round(raw.stars))) : 5,
    laurels: typeof raw.laurels === "boolean" ? raw.laurels : true,
    textColor: typeof raw.textColor === "string" && /^#[0-9a-fA-F]{6}$/.test(raw.textColor)
      ? raw.textColor : "#131316",
  };
}

// Explicit blank translations hide a line instead of reviving the fallback.
export function badgeText(value: LocalizedText, locale: string) {
  return (value[locale] ?? pickText(value, locale)).replace(/\s+/g, " ").trim();
}

export function createAwardBadge(id: string, locale: string, width: number, height: number, zIndex: number, preset: AwardBadgePreset = AWARD_BADGE_PRESETS[0]): DecorationElement {
  const badgeWidth = Math.min(width * 0.64, height * 0.9);
  return {
    id, kind: "award-badge",
    transform: { x: (width - badgeWidth) / 2, y: height * 0.22, width: badgeWidth, height: badgeWidth / 2, rotation: 0, zIndex },
    fill: { type: "solid", colors: [preset.color] }, opacity: 1,
    badge: presetBadge(preset, locale),
  };
}
