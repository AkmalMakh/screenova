"use client";
import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, Copy, GripVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pickText } from "@/lib/locale";
import type { Device, Orientation, Slide, Theme } from "@/lib/types";
import { layoutLabel, useT } from "@/lib/ui-i18n";
import { cn } from "@/lib/utils";
import { DeckCanvas, SlideCanvas, getCanvas } from "./slide-canvas";

type Props = {
  slide: Slide;
  slides: Slide[];
  index: number;
  active: boolean;
  device: Device;
  orientation: Orientation;
  theme: Theme;
  locale: string;
  appName?: string;
  appIcon?: string;
  connectedCanvas: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  selectedForDesign?: boolean;
  /** The AI composer is targeting "Selected screens": offer the mark box. */
  showDesignSelection?: boolean;
  onToggleDesignSelection?: () => void;
};

// Thumb tile width (pixels). Height follows the device aspect, clamped so a
// phone reads as a phone and a feature graphic stays a strip.
const THUMB_W = 52;

export function SlideThumb({
  slide,
  slides,
  index,
  active,
  device,
  orientation,
  theme,
  locale,
  appName,
  appIcon,
  connectedCanvas,
  onSelect,
  onDelete,
  onDuplicate,
  selectedForDesign,
  showDesignSelection,
  onToggleDesignSelection,
}: Props) {
  const { t } = useT();
  const headline = pickText(slide.headline, locale);
  const label = pickText(slide.label, locale);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: slide.id,
    // Neighbours make room on the DESIGN.md move curve.
    transition: { duration: 200, easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
  });

  const { cW, cH } = getCanvas(device, orientation);
  const aspect = cW / cH;
  const tileH = Math.max(28, Math.min(120, Math.round(THUMB_W / aspect)));
  const scale = THUMB_W / cW;
  const start = connectedCanvas ? Math.max(0, index - 1) : index;
  const visibleSlides = connectedCanvas ? slides.slice(start, Math.min(slides.length, index + 2)) : [slide];
  const localIndex = index - start;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex items-start gap-2.5 rounded-lg border border-transparent p-1.5 transition-[background-color,border-color,box-shadow] duration-micro ease-out hover:bg-accent/70",
        active && "border-primary/40 bg-primary/[0.06] hover:bg-primary/[0.08]",
        isDragging && "z-10 bg-card shadow-pop ring-1 ring-primary/30",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? "true" : undefined}
        className="flex min-w-0 flex-1 items-start gap-2.5 rounded-sm text-left"
      >
        <span
          aria-hidden
          className={cn(
            "relative shrink-0 overflow-hidden rounded-xs border bg-muted shadow-sm transition-shadow duration-micro",
            active ? "border-primary ring-1 ring-primary" : "border-border",
          )}
          style={{ width: THUMB_W, height: tileH }}
        >
          <span
            className="block"
            style={{
              width: cW * visibleSlides.length,
              height: cH,
              position: "absolute",
              top: 0,
              left: -localIndex * cW * scale,
              transformOrigin: "top left",
              transform: `scale(${scale})`,
              pointerEvents: "none",
            }}
          >
            {connectedCanvas ? (
              <DeckCanvas
                slides={visibleSlides}
                device={device}
                orientation={orientation}
                theme={theme}
                locale={locale}
                appName={appName}
                appIcon={appIcon}
                connectedCanvas
                editable={false}
              />
            ) : (
              <SlideCanvas
                slide={slide}
                device={device}
                orientation={orientation}
                theme={theme}
                locale={locale}
                appName={appName}
                appIcon={appIcon}
                editable={false}
              />
            )}
          </span>
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
          <span className="truncate text-caption tabular-nums text-muted-foreground">
            {t("thumb.screenN", { index: index + 1, layout: layoutLabel(slide.layout, t) })}
          </span>
          <span className="line-clamp-2 text-footnote font-medium leading-snug text-foreground">
            {headline.replace(/\n+/g, " ") || (
              <em className="font-normal text-muted-foreground">{t("thumb.untitled")}</em>
            )}
          </span>
          {label ? (
            <span className="truncate text-caption text-muted-foreground">{label}</span>
          ) : null}
        </span>
      </button>

      {/* Marking screens for an AI pass: only offered while the composer is
          set to "Selected screens" (or once a screen is already marked). */}
      {onToggleDesignSelection && (showDesignSelection || selectedForDesign) && (
        <button
          type="button"
          className={cn(
            "absolute left-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-xs border bg-card/95 shadow-sm transition-colors duration-micro",
            selectedForDesign && "border-primary bg-primary text-primary-foreground",
          )}
          onClick={(event) => {
            event.stopPropagation();
            onToggleDesignSelection();
          }}
          aria-pressed={!!selectedForDesign}
          aria-label={selectedForDesign ? t("thumb.removeFromAi") : t("thumb.addToAi")}
          title={selectedForDesign ? t("thumb.selectedForAi") : t("thumb.selectForAi")}
        >
          {selectedForDesign && <Check className="h-3 w-3" />}
        </button>
      )}

      {/* Row actions appear with intent (hover, keyboard focus, the active
          screen) and are always present on touch screens. */}
      <div className="absolute bottom-1 right-1 flex items-center rounded-sm bg-card/95 opacity-0 shadow-sm ring-1 ring-border/70 transition-opacity duration-micro ease-out focus-within:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100">
        <button
          type="button"
          className="flex h-7 w-6 cursor-grab items-center justify-center rounded-l-sm text-muted-foreground hover:text-foreground focus-visible:text-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
          aria-label={t("thumb.reorderA11y", { index: index + 1 })}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 rounded-none"
          onClick={onDuplicate}
          aria-label={t("thumb.duplicateA11y", { index: index + 1 })}
          title={t("thumb.duplicate")}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 rounded-l-none rounded-r-sm hover:text-destructive"
          onClick={onDelete}
          aria-label={t("thumb.deleteA11y", { index: index + 1 })}
          title={t("thumb.delete")}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
