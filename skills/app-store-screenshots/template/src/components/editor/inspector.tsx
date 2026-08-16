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
} from "lucide-react";
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
import { ScreenshotPicker } from "./screenshot-picker";
import { getCanvas, getElementTransform } from "./slide-canvas";

type Props = {
  slide: Slide;
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
  device,
  orientation,
  locale,
  locales,
  selectedElementId,
  onChange,
  onSelectElement,
}: Props) {
  const { t } = useT();
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

  React.useEffect(() => {
    if (device === "feature-graphic" && slide.layout !== "feature-graphic") {
      onChange({ layout: "feature-graphic", transforms: undefined, screenshotSecondary: undefined });
    }
  }, [device, onChange, slide.layout]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/70 p-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">{t("inspector.screenSettings")}</h2>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {t("inspector.editingLocale", { locale: locale.toUpperCase() })}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{layoutHint(layoutValue, t)}</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{t("inspector.layout")}</Label>
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
            <SelectTrigger>
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
            <Label className="text-xs">{t("inspector.label")}</Label>
            <Input
              value={localeLabel}
              onChange={(e) => setLocaleField("label", e.target.value)}
              placeholder={labelPlaceholder}
            />
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <Label className="text-xs">
              {isFeatureGraphic ? t("inspector.tagline") : t("inspector.headline")}
            </Label>
            <span className="text-[10px] text-muted-foreground">{t("inspector.newlineBreak")}</span>
          </div>
          <Textarea
            value={localeHeadline}
            onChange={(e) => setLocaleField("headline", e.target.value)}
            rows={3}
            placeholder={headlinePlaceholder}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">
            {isFeatureGraphic ? t("inspector.taglineFont") : t("inspector.headlineFont")}
          </Label>
          <Select
            value={slide.headlineFontFamily || "modern"}
            onValueChange={(value) =>
              onChange({ headlineFontFamily: value as HeadlineFontFamily })
            }
          >
            <SelectTrigger>
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
          <div className="space-y-2 rounded-md border bg-muted/25 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <Label className="flex items-center gap-1.5 text-xs">
                <ImageIcon className="h-3.5 w-3.5" /> {t("inspector.gptImage")}
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] hover:text-destructive"
                onClick={() => onChange({ visualAsset: undefined })}
              >
                {t("inspector.remove")}
              </Button>
            </div>
            <img
              src={img(slide.visualAsset.src)}
              alt={t("inspector.generatedVisualAlt")}
              className="h-20 w-full rounded border object-cover"
            />
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
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
            <p className="line-clamp-3 text-[10px] leading-relaxed text-muted-foreground">
              {slide.visualAsset.prompt}
            </p>
          </div>
        )}

        {!isFeatureGraphic && !isNoDevice && (
          <div className="space-y-1.5">
            <Label className="text-xs">
              {slide.layout === "two-devices"
                ? t("inspector.frontScreenshot")
                : t("inspector.screenshot")}
            </Label>
            <ScreenshotPicker
              label={t("inspector.primary")}
              value={slide.screenshot}
              locale={locale}
              locales={locales}
              localizedSlug={`${slide.id}-primary`}
              onChange={(v) => onChange({ screenshot: v })}
            />
          </div>
        )}

        {slide.layout === "two-devices" && (
          <div className="space-y-1.5">
            <Label className="text-xs">{t("inspector.backScreenshot")}</Label>
            <ScreenshotPicker
              label={t("inspector.secondary")}
              value={slide.screenshotSecondary || ""}
              locale={locale}
              locales={locales}
              localizedSlug={`${slide.id}-secondary`}
              onChange={(v) => onChange({ screenshotSecondary: v })}
            />
          </div>
        )}

        {!isFeatureGraphic && (
          <ElementTransformControls
            slide={slide}
            device={device}
            orientation={orientation}
            locale={locale}
            selectedElementId={selectedElementId}
            onChange={onChange}
            onSelectElement={onSelectElement}
          />
        )}

        {isFeatureGraphic && (
          <p className="rounded-md border bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
            {t("inspector.appIconNote")}
          </p>
        )}
      </div>
    </div>
  );
}

function ElementTransformControls({
  slide,
  device,
  orientation,
  locale,
  selectedElementId,
  onChange,
  onSelectElement,
}: {
  slide: Slide;
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

  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Label className="text-xs font-semibold">{t("inspector.elements")}</Label>
          <p className="text-[11px] text-muted-foreground">
            {activeId ? t("inspector.elementsHintSelected") : t("inspector.elementsHint")}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={addDecoration}
          >
            <Circle className="h-3.5 w-3.5" />
            {t("inspector.shape")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={addTextElement}
          >
            <Plus className="h-3.5 w-3.5" />
            {t("inspector.text")}
          </Button>
        </div>
      </div>

      {activeId ? (
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
          onDeleteText={() => {
            if (activeTextElement) deleteTextElement(activeTextElement);
          }}
          onDecorationPatch={(patch) => {
            if (activeDecoration) patchDecoration(activeDecoration.id, patch);
          }}
          onDeleteDecoration={() => {
            if (activeDecoration) deleteDecoration(activeDecoration);
          }}
        />
      ) : (
        <div className="rounded border border-dashed bg-background/40 p-4 text-center text-[11px] text-muted-foreground">
          {t("inspector.noElement")}
        </div>
      )}
    </div>
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
  onDeleteText,
  onDecorationPatch,
  onDeleteDecoration,
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
  onDeleteText: () => void;
  onDecorationPatch: (patch: Partial<DecorationElement>) => void;
  onDeleteDecoration: () => void;
}) {
  const { t } = useT();
  const engaged = !!transform;
  const rotation = transform?.rotation ?? 0;
  const label = elementLabelFor(activeId, t);
  return (
    <div className="space-y-2 rounded border bg-background/60 p-2.5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-xs font-medium">
          {textElement && <Type className="h-3.5 w-3.5" />}
          {decoration && <Circle className="h-3.5 w-3.5" />}
          {label}
        </span>
        {textElement || decoration ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:text-destructive"
            onClick={decoration ? onDeleteDecoration : onDeleteText}
            title={
              decoration
                ? t("inspector.deleteDecorationA11y")
                : t("inspector.deleteTextA11y")
            }
            aria-label={
              decoration
                ? t("inspector.deleteDecorationA11y")
                : t("inspector.deleteTextA11y")
            }
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        ) : !engaged ? (
          <span className="text-[10px] text-muted-foreground">{t("inspector.dragToEnable")}</span>
        ) : null}
      </div>

      {textElement && (
        <TextElementPanel
          element={textElement}
          locale={locale}
          onTextChange={onTextChange}
          onTextPatch={onTextPatch}
        />
      )}

      {decoration && (
        <DecorationPanel element={decoration} onPatch={onDecorationPatch} />
      )}

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <RotateCw className="h-3 w-3" /> {t("inspector.rotation")}
          </Label>
          <span className="text-[11px] tabular-nums text-muted-foreground">
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
        <Label className="text-[11px] text-muted-foreground">{t("inspector.layer")}</Label>
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
    <div className="space-y-2 rounded border bg-muted/30 p-2">
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">{t("inspector.text")}</Label>
        <Textarea
          value={text}
          rows={2}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder={t("inspector.overlayText")}
        />
      </div>
      <div className="grid grid-cols-[1fr_76px] gap-2">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">{t("inspector.size")}</Label>
          <Input
            type="number"
            min={12}
            max={400}
            value={Math.round(element.fontSize || 72)}
            onChange={(event) => onTextPatch({ fontSize: Number(event.target.value) || 72 })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">{t("inspector.color")}</Label>
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
          onClick={() => onTextPatch({ align: "left" })}
          label={t("inspector.alignLeft")}
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </LayerButton>
        <LayerButton
          disabled={false}
          onClick={() => onTextPatch({ align: "center" })}
          label={t("inspector.alignCenter")}
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </LayerButton>
        <LayerButton
          disabled={false}
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
    <div className="space-y-2 rounded border bg-muted/30 p-2">
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">{t("inspector.shape")}</Label>
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
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">{t("inspector.fill")}</Label>
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
          <Label className="text-[11px] text-muted-foreground">{t("inspector.style")}</Label>
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
          <Label className="text-[11px] text-muted-foreground">{t("inspector.opacity")}</Label>
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
          <Label className="text-[11px] text-muted-foreground">{t("inspector.blur")}</Label>
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
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 px-0"
      disabled={disabled}
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      {children}
    </Button>
  );
}

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
