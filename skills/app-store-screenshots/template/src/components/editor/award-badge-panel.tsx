"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AWARD_BADGE_PRESETS, cleanAwardBadge, presetBadge, type AwardBadgePreset } from "@/lib/award-badge";
import { normalizeCopyText, pickText } from "@/lib/locale";
import type { AwardBadge, DecorationElement } from "@/lib/types";
import { useT } from "@/lib/ui-i18n";
import { AwardBadge as BadgePreview } from "./award-badge";

export function AwardBadgePresets({ locale, onSelect }: { locale: string; onSelect: (preset: AwardBadgePreset) => void }) {
  const { t, lang } = useT();
  return <div className="space-y-2" aria-label={t("badge.name")}>
    {AWARD_BADGE_PRESETS.map((preset) => <button key={preset.id} type="button"
      className="flex min-h-20 w-full flex-col items-stretch gap-1 overflow-hidden rounded-lg border border-border bg-background p-2 text-center text-[13px] font-medium hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`${t("badge.name")} — ${preset.name[lang]}`}
      onClick={() => onSelect(preset)}>
      <span className="block w-full rounded-sm px-1 py-2" style={{ background: preset.background }}>
        <BadgePreview badge={presetBadge(preset, locale)} color={preset.color} locale={locale} />
      </span>
      <span>{preset.name[lang]}</span>
    </button>)}
  </div>;
}

export function AwardBadgePanel({ element, locale, onPatch, onDuplicate }: {
  element: DecorationElement; locale: string;
  onPatch: (patch: Partial<DecorationElement>) => void;
  onDuplicate: () => void;
}) {
  const { t } = useT();
  const badge = cleanAwardBadge(element.badge);
  const patch = (value: Partial<AwardBadge>) => onPatch({ badge: { ...badge, ...value } });
  return <div className="space-y-3">
    <div className="rounded-sm p-2" style={{ background: parseInt(badge.textColor.slice(1, 3), 16) > 150 ? "#29232F" : "#FCE3A6" }}>
      <BadgePreview badge={badge} color={element.fill.colors[0]} locale={locale} />
    </div>
    <p className="text-xs leading-relaxed text-muted-foreground">{t("badge.hint")}</p>
    {(["eyebrow", "title"] as const).map((field) => <label key={field} className="block space-y-1">
      <span className="text-[13px] font-medium">{t(`badge.${field}`)}</span>
      <Input aria-label={t(`badge.${field}`)} maxLength={64}
        value={badge[field][locale] ?? pickText(badge[field], locale)}
        onChange={(event) => patch({ [field]: { ...badge[field], [locale]: normalizeCopyText(event.target.value) } })} />
    </label>)}
    <AwardBadgePresets locale={locale} onSelect={(preset) => onPatch({
      fill: { type: "solid", colors: [preset.color] }, opacity: 1, blur: 0,
      badge: { ...badge, stars: 5, laurels: true, textColor: preset.color },
    })} />
    <label className="block space-y-1">
      <span className="text-[13px] font-medium">{t("badge.stars")}</span>
      <Input aria-label={t("badge.stars")} type="number" min={0} max={5} step={1} value={badge.stars}
        onChange={(event) => patch({ stars: Math.max(0, Math.min(5, Math.round(Number(event.target.value) || 0))) })} />
    </label>
    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[13px]">
      <input type="checkbox" checked={badge.laurels} onChange={(event) => patch({ laurels: event.target.checked })} />
      {t("badge.laurels")}
    </label>
    {(["artColor", "textColor"] as const).map((field) => <label key={field} className="block space-y-1">
      <span className="text-[13px] font-medium">{t(`badge.${field}`)}</span>
      <Input type="color" className="h-11 p-1" aria-label={t(`badge.${field}`)}
        value={field === "artColor" ? element.fill.colors[0] : badge.textColor}
        onChange={(event) => field === "artColor"
          ? onPatch({ fill: { type: "solid", colors: [event.target.value] } })
          : patch({ textColor: event.target.value })} />
    </label>)}
    <label className="block space-y-1">
      <span className="text-[13px] font-medium">{t("badge.width")}</span>
      <Input aria-label={t("badge.width")} type="number" min={80} max={4000} value={Math.round(element.transform.width)}
        onChange={(event) => {
          const width = Math.max(80, Math.min(4000, Number(event.target.value) || 80));
          onPatch({ transform: { ...element.transform, width, height: width / 2 } });
        }} />
    </label>
    <Button type="button" variant="outline" className="w-full text-[13px]" onClick={onDuplicate}>{t("badge.duplicate")}</Button>
  </div>;
}
