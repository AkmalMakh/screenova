"use client";
import * as React from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowUpToLine,
  ChevronDown,
  ChevronUp,
  Circle,
  ImageIcon,
  Plus,
  RotateCw,
  Trash2,
  Type,
  Award,
  X,
} from "lucide-react";
import { createAwardBadge, type AwardBadgePreset } from "@/lib/award-badge";
import { AwardBadgePanel, AwardBadgePresets } from "./award-badge-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { HEADLINE_FONT_LABEL, LAYOUT_LABEL } from "@/lib/constants";
import { DECORATION_ICON_NAMES, DEFAULT_DECORATION_ICON } from "@/lib/decoration-icon-names";
import { nid } from "@/lib/defaults";
import {
  decorationElementKey,
  isBuiltInElementId,
  isDecorationElementId,
  isTextElementId,
  textElementKey,
  toDecorationElementId,
  toTextElementId,
} from "@/lib/elements";
import { pickText, writeLocalized } from "@/lib/locale";
import { img } from "@/lib/image-cache";
import type {
  DecorationElement,
  Device,
  ElementId,
  ElementTransform,
  HeadlineFontFamily,
  Orientation,
  Slide,
  SlideLayout,
  TextElement,
} from "@/lib/types";
import {
  elementLabel,
  fontLabel,
  layoutHint,
  layoutLabel,
  useT,
  type T,
} from "@/lib/ui-i18n";
import { cn } from "@/lib/utils";
import { ScreenshotPicker } from "./screenshot-picker";
import { getCanvas, getElementTransform } from "./slide-canvas";

type Props = {
  slide: Slide;
  artworkColor?: string;
  device: Device;
  orientation: Orientation;
  locale: string;
  locales: string[];
  selectedElementId: ElementId | null;
  onChange: (patch: Partial<Slide>) => void;
  onSelectElement: (id: ElementId | null) => void;
};

export function Inspector({
  slide,
  artworkColor = "#131316",
  device,
  orientation,
  locale,
  locales,
  selectedElementId,
  onChange,
  onSelectElement,
}: Props) {
  const { t } = useT();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const fieldId = React.useId();
  const selectedDevice = selectedElementId === "device" || selectedElementId === "deviceSecondary" ? selectedElementId : null;
  // A canvas selection brings its controls to the top of the inspector.
  React.useEffect(() => {
    if (!selectedElementId) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scrollRef.current?.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }, [selectedElementId, slide.id]);
  const isFeatureGraphic = device === "feature-graphic" || slide.layout === "feature-graphic";
  const isNoDevice = slide.layout === "no-device";
  const layoutValue = device === "feature-graphic" ? "feature-graphic" : slide.layout;
  const layoutOptions = (Object.keys(LAYOUT_LABEL) as SlideLayout[]).filter((layout) =>
    device === "feature-graphic" ? layout === "feature-graphic" : layout !== "feature-graphic",
  );
  const localeLabel = slide.label?.[locale] ?? "";
  const localeHeadline = slide.headline?.[locale] ?? "";
  // When the active locale is empty, surface the fallback (typically en) as
  // the placeholder so the user sees what they're translating from.
  const headlineDefault = isFeatureGraphic
    ? t("canvas.taglinePlaceholder")
    : t("canvas.oneIdeaPlaceholder");
  const labelPlaceholder = localeLabel
    ? t("inspector.feature01")
    : pickText(slide.label, locale) || t("inspector.feature01");
  const headlinePlaceholder = localeHeadline
    ? headlineDefault
    : pickText(slide.headline, locale) || headlineDefault;

  function setLocaleField(key: "label" | "headline", value: string) {
    onChange({ [key]: writeLocalized(slide[key], locale, value) } as Partial<Slide>);
  }

  function screenshotControl(secondary: boolean) {
    const elementId = secondary ? "deviceSecondary" : "device";
    if (isFeatureGraphic || isNoDevice || (secondary && slide.layout !== "two-devices")) return null;
    return <div key={elementId} data-screenshot-control={elementId} className="space-y-1.5">
      <Label className={FIELD_LABEL}>
        {secondary ? t("inspector.backScreenshot") : slide.layout === "two-devices" ? t("inspector.frontScreenshot") : t("inspector.screenshot")}
      </Label>
      <ScreenshotPicker
        key={`${slide.id}-${elementId}-${locale}`}
        label={secondary ? t("inspector.secondary") : t("inspector.primary")}
        value={secondary ? slide.screenshotSecondary || "" : slide.screenshot}
        locale={locale}
        locales={locales}
        localizedSlug={`${slide.id}-${secondary ? "secondary" : "primary"}`}
        onChange={(value) => onChange(secondary ? { screenshotSecondary: value } : { screenshot: value })}
      />
    </div>;
  }

  React.useEffect(() => {
    if (device === "feature-graphic" && slide.layout !== "feature-graphic") {
      onChange({ layout: "feature-graphic", transforms: undefined, screenshotSecondary: undefined });
    }
  }, [device, onChange, slide.layout]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/70 px-3 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-subhead font-semibold tracking-tight">
            {t("inspector.screenSettings")}
          </h2>
          <span className="rounded-full border border-border/70 bg-muted/60 px-1.5 py-0.5 text-caption font-medium uppercase tracking-wide text-muted-foreground">
            {t("inspector.editingLocale", { locale: locale.toUpperCase() })}
          </span>
        </div>
        <p className="mt-0.5 text-caption text-muted-foreground">{layoutHint(layoutValue, t)}</p>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-3">
        {selectedDevice && screenshotControl(selectedDevice === "deviceSecondary")}
        <ElementTransformControls
          part="selection"
          slide={slide}
          artworkColor={artworkColor}
          device={device}
          orientation={orientation}
          locale={locale}
          selectedElementId={selectedElementId}
          onChange={onChange}
          onSelectElement={onSelectElement}
        />
        <div className="space-y-1.5">
          <Label htmlFor={`${fieldId}-layout`} className={FIELD_LABEL}>{t("inspector.layout")}</Label>
          <Select
            value={layoutValue}
            onValueChange={(layout) => {
              const next = layout as SlideLayout;
              onChange({
                layout: next,
                transforms: undefined,
                screenshotSecondary:
                  next === "two-devices" ? slide.screenshotSecondary || slide.screenshot : undefined,
              });
            }}
          >
            <SelectTrigger id={`${fieldId}-layout`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {layoutOptions.map((layout) => (
                <SelectItem key={layout} value={layout}>
                  {layoutLabel(layout, t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!isFeatureGraphic && (
          <div className="space-y-1.5">
            <Label htmlFor={`${fieldId}-label`} className={FIELD_LABEL}>{t("inspector.label")}</Label>
            <Input
              id={`${fieldId}-label`}
              aria-label={t("inspector.label")}
              value={localeLabel}
              onChange={(e) => setLocaleField("label", e.target.value)}
              placeholder={labelPlaceholder}
            />
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <Label htmlFor={`${fieldId}-headline`} className={FIELD_LABEL}>
              {isFeatureGraphic ? t("inspector.tagline") : t("inspector.headline")}
            </Label>
            <span className="text-caption text-muted-foreground">{t("inspector.newlineBreak")}</span>
          </div>
          <Textarea
            id={`${fieldId}-headline`}
            aria-label={isFeatureGraphic ? t("inspector.tagline") : t("inspector.headline")}
            value={localeHeadline}
            onChange={(e) => setLocaleField("headline", e.target.value)}
            rows={3}
            placeholder={headlinePlaceholder}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`${fieldId}-font`} className={FIELD_LABEL}>
            {isFeatureGraphic ? t("inspector.taglineFont") : t("inspector.headlineFont")}
          </Label>
          <Select
            value={slide.headlineFontFamily || "modern"}
            onValueChange={(value) =>
              onChange({ headlineFontFamily: value as HeadlineFontFamily })
            }
          >
            <SelectTrigger id={`${fieldId}-font`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(HEADLINE_FONT_LABEL) as HeadlineFontFamily[]).map((value) => (
                <SelectItem key={value} value={value}>
                  {fontLabel(value, t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {slide.visualAsset && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label className={cn(FIELD_LABEL, "flex items-center gap-1.5")}>
                <ImageIcon className="h-3.5 w-3.5" /> {t("inspector.gptImage")}
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-caption hover:text-destructive"
                onClick={() => onChange({ visualAsset: undefined })}
              >
                {t("inspector.remove")}
              </Button>
            </div>
            <img
              src={img(slide.visualAsset.src)}
              alt={t("inspector.generatedVisualAlt")}
              className="h-20 w-full rounded-xs border object-cover"
            />
            <div className="space-y-1">
              <div className="flex items-center justify-between text-caption text-muted-foreground">
                <span>{t("inspector.opacity")}</span>
                <span>{Math.round(slide.visualAsset.opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min={5}
                max={100}
                step={1}
                value={Math.round(slide.visualAsset.opacity * 100)}
                onChange={(event) =>
                  onChange({
                    visualAsset: {
                      ...slide.visualAsset!,
                      opacity: Number(event.target.value) / 100,
                    },
                  })
                }
                className="w-full"
                aria-label={t("inspector.opacityA11y")}
              />
            </div>
            <p className="line-clamp-3 text-caption leading-relaxed text-muted-foreground">
              {slide.visualAsset.prompt}
            </p>
          </div>
        )}

        {selectedDevice !== "device" && screenshotControl(false)}
        {selectedDevice !== "deviceSecondary" && screenshotControl(true)}

          <ElementTransformControls
            part="library"
            slide={slide}
            artworkColor={artworkColor}
            device={device}
            orientation={orientation}
            locale={locale}
            selectedElementId={selectedElementId}
            onChange={onChange}
            onSelectElement={onSelectElement}
          />

        {isFeatureGraphic && (
          <p className="text-caption leading-relaxed text-muted-foreground">
            {t("inspector.appIconNote")}
          </p>
        )}
      </div>
    </div>
  );
}

// Rendered twice: part="selection" (top of the inspector, only while
// something is selected) and part="library" (add shape/text/badge, bottom).
// One body, so both share the same patch/reorder helpers.
function ElementTransformControls({
  part,
  slide,
  artworkColor,
  device,
  orientation,
  locale,
  selectedElementId,
  onChange,
  onSelectElement,
}: {
  part: "selection" | "library";
  slide: Slide;
  artworkColor: string;
  device: Device;
  orientation: Orientation;
  locale: string;
  selectedElementId: ElementId | null;
  onChange: (patch: Partial<Slide>) => void;
  onSelectElement: (id: ElementId | null) => void;
}) {
  const { t } = useT();
  const present: ElementId[] = ["caption"];
  if (slide.layout !== "no-device") present.push("device");
  if (slide.layout === "two-devices") present.push("deviceSecondary");
  for (const element of slide.textElements || []) present.push(toTextElementId(element.id));
  for (const element of slide.decorations || []) present.push(toDecorationElementId(element.id));

  const transforms = slide.transforms || {};
  const activeId =
    selectedElementId && present.includes(selectedElementId) ? selectedElementId : null;
  const activeTransform = activeId
    ? getElementTransform(slide, device, orientation, activeId)
    : undefined;
  const activeTextElement =
    activeId && isTextElementId(activeId)
      ? slide.textElements?.find((element) => element.id === textElementKey(activeId))
      : null;
  const activeDecoration =
    activeId && isDecorationElementId(activeId)
      ? slide.decorations?.find((element) => element.id === decorationElementKey(activeId))
      : null;

  function getTransform(id: ElementId) {
    return getElementTransform(slide, device, orientation, id);
  }

  function patchElement(id: ElementId, patch: Partial<ElementTransform>) {
    const cur = getTransform(id);
    if (!cur) return;
    if (isTextElementId(id)) {
      const textId = textElementKey(id);
      onChange({
        textElements: (slide.textElements || []).map((element) =>
          element.id === textId
            ? { ...element, transform: { ...element.transform, ...patch } }
            : element,
        ),
      });
      return;
    }
    if (isDecorationElementId(id)) {
      const decorationId = decorationElementKey(id);
      onChange({
        decorations: (slide.decorations || []).map((element) =>
          element.id === decorationId
            ? { ...element, transform: { ...element.transform, ...patch } }
            : element,
        ),
      });
      return;
    }
    if (!isBuiltInElementId(id)) return;
    onChange({
      transforms: { ...transforms, [id]: { ...cur, ...patch } },
    });
  }

  function patchTextElement(id: string, patch: Partial<TextElement>) {
    onChange({
      textElements: (slide.textElements || []).map((element) =>
        element.id === id ? { ...element, ...patch } : element,
      ),
    });
  }

  function setTextElementValue(element: TextElement, value: string) {
    patchTextElement(element.id, { text: writeLocalized(element.text, locale, value) });
  }

  function deleteTextElement(element: TextElement) {
    const nextTextElements = (slide.textElements || []).filter((item) => item.id !== element.id);
    onChange({
      textElements: nextTextElements.length > 0 ? nextTextElements : undefined,
    });
    onSelectElement(null);
  }

  function addTextElement() {
    const { cW, cH } = getCanvas(device, orientation);
    const id = nid();
    const zIndex =
      Math.max(
        5,
        ...present.map((elementId) => getTransform(elementId)?.zIndex ?? defaultZ(elementId)),
      ) + 1;
    const element: TextElement = {
      id,
      text: writeLocalized({}, locale, "New text"),
      transform: {
        x: cW * 0.18,
        y: cH * 0.42,
        width: cW * 0.64,
        height: cH * 0.12,
        rotation: 0,
        zIndex,
      },
      fontSize: Math.round(Math.min(cW, cH) * 0.065),
      fontWeight: 800,
      align: "center",
    };
    onChange({ textElements: [...(slide.textElements || []), element] });
    onSelectElement(toTextElementId(id));
  }

  function patchDecoration(id: string, patch: Partial<DecorationElement>) {
    onChange({
      decorations: (slide.decorations || []).map((element) =>
        element.id === id ? { ...element, ...patch } : element,
      ),
    });
  }

  function deleteDecoration(element: DecorationElement) {
    const next = (slide.decorations || []).filter((item) => item.id !== element.id);
    onChange({ decorations: next.length ? next : undefined });
    onSelectElement(null);
  }

  function addDecoration() {
    const { cW, cH } = getCanvas(device, orientation);
    const id = nid();
    const decoration: DecorationElement = {
      id,
      kind: "ellipse",
      transform: {
        x: cW * 0.1,
        y: cH * 0.18,
        width: cW * 0.28,
        height: cW * 0.28,
        rotation: 0,
        zIndex: 1,
      },
      fill: { type: "solid", colors: ["#5B7CFA"] },
      opacity: 0.3,
      blur: 0,
    };
    onChange({ decorations: [...(slide.decorations || []), decoration] });
    onSelectElement(toDecorationElementId(id));
  }

  function addBadge(preset?: AwardBadgePreset) {
    const { cW, cH } = getCanvas(device, orientation);
    const id = nid();
    const zIndex = Math.max(5, ...present.map((elementId) => getTransform(elementId)?.zIndex ?? defaultZ(elementId))) + 1;
    const badge = createAwardBadge(id, locale, cW, cH, zIndex, preset);
    if (!preset) {
      badge.fill.colors = [artworkColor];
      badge.badge!.textColor = artworkColor;
    }
    onChange({ decorations: [...(slide.decorations || []), badge] });
    onSelectElement(toDecorationElementId(id));
  }

  function duplicateDecoration() {
    if (!activeDecoration) return;
    const id = nid();
    const copy = structuredClone(activeDecoration);
    copy.id = id;
    copy.transform = { ...copy.transform, x: copy.transform.x + 32, y: copy.transform.y + 32,
      zIndex: Math.max(5, ...present.map((elementId) => getTransform(elementId)?.zIndex ?? defaultZ(elementId))) + 1 };
    onChange({ decorations: [...(slide.decorations || []), copy] });
    onSelectElement(toDecorationElementId(id));
  }

  // Z-order: re-rank zIndex among present elements so they remain contiguous.
  function reorder(id: ElementId, dir: "front" | "back" | "up" | "down") {
    const ranked = [...present].sort((a, b) => {
      const za = getTransform(a)?.zIndex ?? defaultZ(a);
      const zb = getTransform(b)?.zIndex ?? defaultZ(b);
      return za - zb;
    });
    const idx = ranked.indexOf(id);
    if (idx === -1) return;
    let target = idx;
    if (dir === "front") target = ranked.length - 1;
    else if (dir === "back") target = 0;
    else if (dir === "up") target = Math.min(ranked.length - 1, idx + 1);
    else if (dir === "down") target = Math.max(0, idx - 1);
    if (target === idx) return;
    ranked.splice(idx, 1);
    ranked.splice(target, 0, id);
    const nextTransforms = { ...transforms };
    const nextTextElements = (slide.textElements || []).map((element) => ({
      ...element,
      transform: { ...element.transform },
    }));
    const nextDecorations = (slide.decorations || []).map((element) => ({
      ...element,
      transform: { ...element.transform },
    }));
    ranked.forEach((eid, i) => {
      const cur = getTransform(eid);
      if (!cur) return;
      if (isTextElementId(eid)) {
        const textId = textElementKey(eid);
        const textElement = nextTextElements.find((element) => element.id === textId);
        if (textElement) textElement.transform = { ...textElement.transform, zIndex: i + 1 };
      } else if (isDecorationElementId(eid)) {
        const decorationId = decorationElementKey(eid);
        const decoration = nextDecorations.find((element) => element.id === decorationId);
        if (decoration) decoration.transform = { ...decoration.transform, zIndex: i + 1 };
      } else if (isBuiltInElementId(eid)) {
        nextTransforms[eid] = { ...cur, zIndex: i + 1 };
      }
    });
    onChange({
      transforms: nextTransforms,
      textElements: nextTextElements,
      decorations: nextDecorations,
    });
  }

  if (part === "selection") {
    if (!activeId) return null;
    const label = activeDecoration?.kind === "award-badge" ? t("badge.name") : elementLabelFor(activeId, t);
    const deleteLabel =
      activeDecoration?.kind === "award-badge"
        ? t("badge.delete")
        : activeDecoration
          ? t("inspector.deleteDecorationA11y")
          : t("inspector.deleteTextA11y");
    return (
      <section
        key={activeId}
        aria-label={t("inspector.selection")}
        className="space-y-3 duration-short animate-in fade-in-0 slide-in-from-top-1"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex min-w-0 items-center gap-1.5 text-footnote font-semibold">
            {activeTextElement && <Type className="h-3.5 w-3.5 shrink-0 text-primary" />}
            {activeDecoration && <Circle className="h-3.5 w-3.5 shrink-0 text-primary" />}
            <span className="truncate">{label}</span>
          </h3>
          <div className="flex shrink-0 items-center">
            {(activeTextElement || activeDecoration) && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() =>
                  activeDecoration ? deleteDecoration(activeDecoration) : activeTextElement && deleteTextElement(activeTextElement)
                }
                title={deleteLabel}
                aria-label={deleteLabel}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={() => onSelectElement(null)}
              title={`${t("inspector.deselect")} · Esc`}
              aria-label={t("inspector.deselect")}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <ActiveElementPanel
          activeId={activeId}
          transform={activeTransform}
          textElement={activeTextElement || undefined}
          decoration={activeDecoration || undefined}
          locale={locale}
          onRotate={(rotation) => patchElement(activeId, { rotation })}
          onReorder={(dir) => reorder(activeId, dir)}
          onTextChange={(value) => {
            if (activeTextElement) setTextElementValue(activeTextElement, value);
          }}
          onTextPatch={(patch) => {
            if (activeTextElement) patchTextElement(activeTextElement.id, patch);
          }}
          onDecorationPatch={(patch) => {
            if (activeDecoration) patchDecoration(activeDecoration.id, patch);
          }}
          onDuplicateDecoration={duplicateDecoration}
        />
        <div aria-hidden className="-mx-3 h-px bg-border/70" />
      </section>
    );
  }

  return (
    <section className="-mx-3 space-y-3 border-t border-border/70 px-3 pt-4">
      <div className="space-y-0.5">
        <h3 className="text-footnote font-semibold">{t("inspector.addElements")}</h3>
        <p className="text-caption text-muted-foreground">{t("inspector.addElementsHint")}</p>
      </div>
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="justify-start px-2.5"
            onClick={addDecoration}
          >
            <Circle className="h-3.5 w-3.5" />
            {t("inspector.shape")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="justify-start px-2.5"
            onClick={addTextElement}
          >
            <Plus className="h-3.5 w-3.5" />
            {t("inspector.text")}
          </Button>
        </div>

      <Button type="button" variant="outline" size="sm" className="w-full justify-start px-2.5" onClick={() => addBadge()}>
        <Award className="h-3.5 w-3.5" /> {t("badge.add")}
      </Button>
      {activeDecoration?.kind !== "award-badge" && <AwardBadgePresets locale={locale} onSelect={addBadge} />}
    </section>
  );
}

function ActiveElementPanel({
  activeId,
  transform,
  textElement,
  decoration,
  locale,
  onRotate,
  onReorder,
  onTextChange,
  onTextPatch,
  onDecorationPatch,
  onDuplicateDecoration,
}: {
  activeId: ElementId;
  transform: ElementTransform | undefined;
  textElement?: TextElement;
  decoration?: DecorationElement;
  locale: string;
  onRotate: (rotation: number) => void;
  onReorder: (dir: "front" | "back" | "up" | "down") => void;
  onTextChange: (value: string) => void;
  onTextPatch: (patch: Partial<TextElement>) => void;
  onDecorationPatch: (patch: Partial<DecorationElement>) => void;
  onDuplicateDecoration: () => void;
}) {
  const { t } = useT();
  const engaged = !!transform;
  const rotation = transform?.rotation ?? 0;
  const label = decoration?.kind === "award-badge" ? t("badge.name") : elementLabelFor(activeId, t);
  return (
    <div className="space-y-3">
      {!engaged && !textElement && !decoration && (
        <p className="text-caption text-muted-foreground">{t("inspector.dragToEnable")}</p>
      )}

      {textElement && (
        <TextElementPanel
          element={textElement}
          locale={locale}
          onTextChange={onTextChange}
          onTextPatch={onTextPatch}
        />
      )}

      {decoration?.kind === "award-badge" ? (
        <AwardBadgePanel element={decoration} locale={locale} onPatch={onDecorationPatch} onDuplicate={onDuplicateDecoration} />
      ) : decoration && (
        <DecorationPanel element={decoration} onPatch={onDecorationPatch} />
      )}

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1 text-caption text-muted-foreground">
            <RotateCw className="h-3 w-3" /> {t("inspector.rotation")}
          </Label>
          <span className="text-caption tabular-nums text-muted-foreground">
            {rotation}°
          </span>
        </div>
        <input
          type="range"
          min={-180}
          max={180}
          step={1}
          value={rotation}
          disabled={!engaged}
          onChange={(e) => onRotate(Number(e.target.value))}
          className="w-full disabled:opacity-50"
          aria-label={t("inspector.rotationA11y", { label })}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-caption text-muted-foreground">{t("inspector.layer")}</Label>
        <div className="grid grid-cols-4 gap-1">
          <LayerButton
            disabled={!engaged}
            onClick={() => onReorder("back")}
            label={t("inspector.sendToBack")}
          >
            <ArrowDownToLine className="h-3.5 w-3.5" />
          </LayerButton>
          <LayerButton
            disabled={!engaged}
            onClick={() => onReorder("down")}
            label={t("inspector.sendBackward")}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </LayerButton>
          <LayerButton
            disabled={!engaged}
            onClick={() => onReorder("up")}
            label={t("inspector.bringForward")}
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </LayerButton>
          <LayerButton
            disabled={!engaged}
            onClick={() => onReorder("front")}
            label={t("inspector.bringToFront")}
          >
            <ArrowUpToLine className="h-3.5 w-3.5" />
          </LayerButton>
        </div>
      </div>
    </div>
  );
}

function TextElementPanel({
  element,
  locale,
  onTextChange,
  onTextPatch,
}: {
  element: TextElement;
  locale: string;
  onTextChange: (value: string) => void;
  onTextPatch: (patch: Partial<TextElement>) => void;
}) {
  const { t } = useT();
  const text = element.text?.[locale] ?? pickText(element.text, locale);
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-caption text-muted-foreground">{t("inspector.text")}</Label>
        <Textarea
          value={text}
          rows={2}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder={t("inspector.overlayText")}
        />
      </div>
      <div className="grid grid-cols-[1fr_76px] gap-2">
        <div className="space-y-1">
          <Label className="text-caption text-muted-foreground">{t("inspector.size")}</Label>
          <Input
            type="number"
            min={12}
            max={400}
            value={Math.round(element.fontSize || 72)}
            onChange={(event) => onTextPatch({ fontSize: Number(event.target.value) || 72 })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-caption text-muted-foreground">{t("inspector.color")}</Label>
          <Input
            type="color"
            value={element.color || "#171717"}
            className="h-9 p-1"
            onChange={(event) => onTextPatch({ color: event.target.value })}
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1">
        <LayerButton
          disabled={false}
          pressed={(element.align ?? "center") === "left"}
          onClick={() => onTextPatch({ align: "left" })}
          label={t("inspector.alignLeft")}
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </LayerButton>
        <LayerButton
          disabled={false}
          pressed={(element.align ?? "center") === "center"}
          onClick={() => onTextPatch({ align: "center" })}
          label={t("inspector.alignCenter")}
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </LayerButton>
        <LayerButton
          disabled={false}
          pressed={(element.align ?? "center") === "right"}
          onClick={() => onTextPatch({ align: "right" })}
          label={t("inspector.alignRight")}
        >
          <AlignRight className="h-3.5 w-3.5" />
        </LayerButton>
      </div>
    </div>
  );
}

function DecorationPanel({
  element,
  onPatch,
}: {
  element: DecorationElement;
  onPatch: (patch: Partial<DecorationElement>) => void;
}) {
  const { t } = useT();
  const primary = element.fill.colors[0] || "#5B7CFA";
  const secondary = element.fill.colors[1] || "#8B5CF6";
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-caption text-muted-foreground">{t("inspector.shape")}</Label>
        <Select
          value={element.kind}
          onValueChange={(kind) =>
            onPatch({ kind: kind as DecorationElement["kind"] })
          }
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ellipse">{t("inspector.ellipse")}</SelectItem>
            <SelectItem value="rounded-rectangle">{t("inspector.roundedRect")}</SelectItem>
            <SelectItem value="line">{t("inspector.line")}</SelectItem>
            <SelectItem value="icon-tile">{t("inspector.iconTile")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {element.kind === "icon-tile" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-caption text-muted-foreground">{t("inspector.icon")}</Label>
            <Select
              value={element.iconName ?? DEFAULT_DECORATION_ICON}
              onValueChange={(iconName) => onPatch({ iconName })}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {DECORATION_ICON_NAMES.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-caption text-muted-foreground">{t("inspector.iconColor")}</Label>
            <Input
              type="color"
              value={element.iconColor ?? "#FFFFFF"}
              className="h-9 p-1"
              onChange={(event) => onPatch({ iconColor: event.target.value })}
            />
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-caption text-muted-foreground">{t("inspector.fill")}</Label>
          <Input
            type="color"
            value={primary}
            className="h-9 p-1"
            onChange={(event) =>
              onPatch({ fill: { ...element.fill, colors: [event.target.value, ...element.fill.colors.slice(1)] } })
            }
          />
        </div>
        <div className="space-y-1">
          <Label className="text-caption text-muted-foreground">{t("inspector.style")}</Label>
          <Select
            value={element.fill.type}
            onValueChange={(type) =>
              onPatch({
                fill: {
                  ...element.fill,
                  type: type as DecorationElement["fill"]["type"],
                  colors: type === "linear-gradient" ? [primary, secondary] : [primary],
                },
              })
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="solid">{t("inspector.solid")}</SelectItem>
              <SelectItem value="linear-gradient">{t("inspector.gradient")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {element.fill.type === "linear-gradient" && (
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="color"
            value={secondary}
            className="h-9 p-1"
            aria-label={t("inspector.gradientSecond")}
            onChange={(event) =>
              onPatch({ fill: { ...element.fill, colors: [primary, event.target.value] } })
            }
          />
          <Input
            type="number"
            min={0}
            max={360}
            value={Math.round(element.fill.angle ?? 135)}
            aria-label={t("inspector.gradientAngle")}
            onChange={(event) =>
              onPatch({ fill: { ...element.fill, angle: Number(event.target.value) || 0 } })
            }
          />
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-caption text-muted-foreground">{t("inspector.opacity")}</Label>
          <Input
            type="number"
            min={5}
            max={100}
            value={Math.round(element.opacity * 100)}
            onChange={(event) =>
              onPatch({ opacity: Math.max(0.05, Math.min(1, Number(event.target.value) / 100)) })
            }
          />
        </div>
        <div className="space-y-1">
          <Label className="text-caption text-muted-foreground">{t("inspector.blur")}</Label>
          <Input
            type="number"
            min={0}
            max={80}
            value={Math.round(element.blur || 0)}
            onChange={(event) => onPatch({ blur: Math.max(0, Number(event.target.value) || 0) })}
          />
        </div>
      </div>
    </div>
  );
}

function LayerButton({
  disabled,
  onClick,
  label,
  pressed,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  label: string;
  /** Toggle buttons (alignment) show and announce the current choice. */
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={pressed ? "secondary" : "outline"}
      size="sm"
      className={cn("h-8 px-0", pressed && "border border-foreground/15")}
      disabled={disabled}
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={pressed}
    >
      {children}
    </Button>
  );
}

// Field labels: 13px, DESIGN.md's floor for controls and labels.
const FIELD_LABEL = "text-footnote font-medium";

// Map an ElementId (which may carry text:/decoration: prefixes) to the
// dictionary element kind, then look up the translated label.
function elementLabelFor(id: ElementId, t: T["t"]): string {
  if (isBuiltInElementId(id)) return elementLabel(id, t);
  if (isDecorationElementId(id)) return elementLabel("decoration", t);
  return elementLabel("text", t);
}

function defaultZ(id: ElementId): number {
  if (isDecorationElementId(id)) return 1;
  if (isTextElementId(id)) return 5;
  if (id === "deviceSecondary") return 2;
  if (id === "device") return 3;
  return 4; // caption on top
}
