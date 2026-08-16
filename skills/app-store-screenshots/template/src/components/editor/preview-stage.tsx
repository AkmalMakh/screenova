"use client";
import * as React from "react";
import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deviceLabel, layoutLabel, useT } from "@/lib/ui-i18n";
import type {
  Device,
  ElementId,
  ElementTransform,
  Orientation,
  SelectedElement,
  Slide,
  Theme,
} from "@/lib/types";
import { DeckCanvas, getCanvas } from "./slide-canvas";

type Props = {
  slides: Slide[];
  activeSlideId: string | null;
  device: Device;
  orientation: Orientation;
  theme: Theme;
  locale: string;
  appName?: string;
  appIcon?: string;
  connectedCanvas: boolean;
  selectedElement: SelectedElement | null;
  onActiveSlideChange: (id: string) => void;
  onLabelChange: (slide: Slide, v: string) => void;
  onHeadlineChange: (slide: Slide, v: string) => void;
  onTextElementTextChange: (slideId: string, id: string, v: string) => void;
  onElementChange: (slideId: string, id: ElementId, t: ElementTransform) => void;
  onSelectElement: (element: SelectedElement | null) => void;
  editable?: boolean;
};

// Fits one full-resolution screen inside the viewport while keeping the whole
// deck horizontally scrollable as one connected canvas.
export function PreviewStage({
  slides,
  activeSlideId,
  device,
  orientation,
  theme,
  locale,
  appName,
  appIcon,
  connectedCanvas,
  selectedElement,
  onActiveSlideChange,
  onLabelChange,
  onHeadlineChange,
  onTextElementTextChange,
  onElementChange,
  onSelectElement,
  editable = true,
}: Props) {
  const { t } = useT();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const suppressNextActiveScreenPanRef = React.useRef(false);
  const [fitScale, setFitScale] = React.useState(0.2);
  const [zoom, setZoom] = React.useState(1);
  const { cW, cH } = getCanvas(device, orientation);
  const totalW = Math.max(1, slides.length) * cW;
  const scale = fitScale * zoom;
  const activeIndex = Math.max(0, slides.findIndex((slide) => slide.id === activeSlideId));
  const activeSlide = slides[activeIndex] || slides[0] || null;

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const sx = (rect.width - 96) / cW;
      const sy = (rect.height - 96) / cH;
      setFitScale(Math.max(0.05, Math.min(sx, sy)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cW, cH]);

  React.useEffect(() => {
    setZoom(1);
  }, [device, orientation]);

  React.useEffect(() => {
    if (suppressNextActiveScreenPanRef.current) {
      suppressNextActiveScreenPanRef.current = false;
      return;
    }

    const scroller = scrollerRef.current;
    if (!scroller || !activeSlide) return;
    const screenLeft = activeIndex * cW * scale;
    const screenWidth = cW * scale;
    const targetLeft = Math.max(0, screenLeft - (scroller.clientWidth - screenWidth) / 2);
    scroller.scrollTo({ left: targetLeft, behavior: "smooth" });
  }, [activeIndex, activeSlide, cW, scale]);

  const handleCanvasActiveSlideChange = React.useCallback(
    (id: string) => {
      if (id !== activeSlideId) {
        suppressNextActiveScreenPanRef.current = true;
      }
      onActiveSlideChange(id);
    },
    [activeSlideId, onActiveSlideChange],
  );

  return (
    <div
      ref={containerRef}
      className="dot-grid relative h-full w-full overflow-hidden"
    >
      <div ref={scrollerRef} className="h-full w-full overflow-auto p-12">
        <div
          style={{
            width: totalW * scale,
            height: cH * scale,
            position: "relative",
            flexShrink: 0,
            filter: "drop-shadow(0 24px 48px hsl(240 10% 8% / 0.14))",
          }}
        >
          <div
            style={{
              width: totalW,
              height: cH,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            <DeckCanvas
              slides={slides}
              device={device}
              orientation={orientation}
              theme={theme}
              locale={locale}
              appName={appName}
              appIcon={appIcon}
              connectedCanvas={connectedCanvas}
              editable={editable}
              previewScale={scale}
              selectedElement={selectedElement}
              activeSlideId={activeSlide?.id || null}
              showGuides
              edit={editable ? {
                onLabelChange: (slideId, value) => {
                  const slide = slides.find((s) => s.id === slideId);
                  if (slide) onLabelChange(slide, value);
                },
                onHeadlineChange: (slideId, value) => {
                  const slide = slides.find((s) => s.id === slideId);
                  if (slide) onHeadlineChange(slide, value);
                },
                onTextElementTextChange,
                onElementChange,
                onSelectElement,
                onSelectScreen: handleCanvasActiveSlideChange,
              } : undefined}
            />
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur-md">
        <span className="font-medium text-foreground">{deviceLabel(device, t)}</span>
        {activeSlide && (
          <>
            <span aria-hidden>·</span>
            <span>{t("preview.screen", { index: activeIndex + 1 })}</span>
            <span aria-hidden>·</span>
            <span>{layoutLabel(activeSlide.layout, t)}</span>
          </>
        )}
        {orientation === "landscape" && (
          <>
            <span aria-hidden>·</span>
            <span>{t("preview.landscape")}</span>
          </>
        )}
        {!connectedCanvas && (
          <>
            <span aria-hidden>·</span>
            <span>{t("preview.isolated")}</span>
          </>
        )}
      </div>

      <div className="absolute bottom-4 right-4 flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-1.5 py-1 text-[10px] tabular-nums text-muted-foreground shadow-sm backdrop-blur-md">
        <span className="px-1">{slides.length}× {cW}×{cH}</span>
        <span aria-hidden className="text-border">|</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setZoom((value) => Math.max(0.25, Number((value - 0.1).toFixed(2))))}
          disabled={zoom <= 0.25}
          title={t("preview.zoomOut")}
          aria-label={t("preview.zoomOut")}
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <span className="min-w-10 text-center">{(scale * 100).toFixed(0)}%</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setZoom((value) => Math.min(2, Number((value + 0.1).toFixed(2))))}
          disabled={zoom >= 2}
          title={t("preview.zoomIn")}
          aria-label={t("preview.zoomIn")}
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setZoom(1)}
          title={t("preview.fitScreen")}
          aria-label={t("preview.fitScreen")}
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
