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

export type CanvasTool = "select" | "pan";

type Offset = { x: number; y: number };

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
  tool: CanvasTool;
  onToolChange: (tool: CanvasTool) => void;
  onActiveSlideChange: (id: string) => void;
  onLabelChange: (slide: Slide, v: string) => void;
  onHeadlineChange: (slide: Slide, v: string) => void;
  onTextElementTextChange: (slideId: string, id: string, v: string) => void;
  onElementChange: (slideId: string, id: ElementId, t: ElementTransform) => void;
  onSelectElement: (element: SelectedElement | null) => void;
  /** Commit a screen's workspace position; null clears it. */
  onScreenOffsetCommit: (slideId: string, offset: Offset | null) => void;
  editable?: boolean;
};

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;
/** Ignore pointer travel below this (screen px) so a drag never eats a click. */
const DRAG_THRESHOLD = 4;

// The whole deck is one pannable, zoomable workspace. Screens can be picked
// up and placed freely (isolated mode); the connected panorama pans as one.
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
  tool,
  onToolChange,
  onActiveSlideChange,
  onLabelChange,
  onHeadlineChange,
  onTextElementTextChange,
  onElementChange,
  onSelectElement,
  onScreenOffsetCommit,
  editable = true,
}: Props) {
  const { t } = useT();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const suppressNextActiveScreenPanRef = React.useRef(false);
  const [fitScale, setFitScale] = React.useState(0.2);
  const [zoom, setZoom] = React.useState(1);
  const [spaceHeld, setSpaceHeld] = React.useState(false);
  const [panning, setPanning] = React.useState(false);
  // Live position of the screen being dragged — committed on release so the
  // project store isn't written 60 times a second.
  const [liveDrag, setLiveDrag] = React.useState<{ id: string; offset: Offset } | null>(null);
  const pendingZoomAnchorRef = React.useRef<{
    pointX: number;
    pointY: number;
    oldScale: number;
  } | null>(null);

  const { cW, cH } = getCanvas(device, orientation);
  const totalW = Math.max(1, slides.length) * cW;
  const scale = fitScale * zoom;
  const activeIndex = Math.max(0, slides.findIndex((slide) => slide.id === activeSlideId));
  const activeSlide = slides[activeIndex] || slides[0] || null;
  const panMode = tool === "pan" || spaceHeld;

  const offsets = React.useMemo(() => {
    const map: Record<string, Offset | undefined> = {};
    for (const slide of slides) {
      if (slide.canvasOffset) map[slide.id] = slide.canvasOffset;
    }
    if (liveDrag) map[liveDrag.id] = liveDrag.offset;
    return map;
  }, [slides, liveDrag]);

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
    // Center the strip inside its apron when the artboard changes.
    const scroller = scrollerRef.current;
    if (scroller) {
      requestAnimationFrame(() => {
        scroller.scrollTop = (scroller.scrollHeight - scroller.clientHeight) / 2;
      });
    }
  }, [device, orientation]);

  // Wheel: pinch / cmd+wheel zooms toward the cursor, plain wheel pans
  // natively via the scroller. React's synthetic wheel handlers are passive,
  // so the listener is attached by hand.
  React.useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const wrap = wrapRef.current;
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const currentScale = fitScale * zoom;
      pendingZoomAnchorRef.current = {
        pointX: (event.clientX - rect.left) / currentScale,
        pointY: (event.clientY - rect.top) / currentScale,
        oldScale: currentScale,
      };
      setZoom((value) => {
        const next = value * Math.exp(-event.deltaY * 0.002);
        return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
      });
    };
    scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => scroller.removeEventListener("wheel", onWheel);
  }, [fitScale, zoom]);

  // Keep the canvas point under the cursor fixed while the scale changes.
  React.useLayoutEffect(() => {
    const anchor = pendingZoomAnchorRef.current;
    const scroller = scrollerRef.current;
    if (!anchor || !scroller) return;
    pendingZoomAnchorRef.current = null;
    const delta = scale - anchor.oldScale;
    scroller.scrollLeft += anchor.pointX * delta;
    scroller.scrollTop += anchor.pointY * delta;
  }, [scale]);

  // Tool shortcuts: V select, H pan, Space temporarily pans (like Figma/Stitch).
  React.useEffect(() => {
    const isTyping = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      !!target.closest("input, textarea, select, [contenteditable]");
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      if (event.key === " " && !event.repeat) {
        event.preventDefault();
        setSpaceHeld(true);
      } else if (event.key === "v" || event.key === "V") {
        onToolChange("select");
      } else if (event.key === "h" || event.key === "H") {
        onToolChange("pan");
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === " ") setSpaceHeld(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [onToolChange]);

  React.useEffect(() => {
    if (suppressNextActiveScreenPanRef.current) {
      suppressNextActiveScreenPanRef.current = false;
      return;
    }

    const scroller = scrollerRef.current;
    const wrap = wrapRef.current;
    if (!scroller || !wrap || !activeSlide) return;
    const padLeft = wrap.offsetLeft;
    const screenLeft = padLeft + activeIndex * cW * scale;
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

  // One pointer handler covers both gestures: pan (hand tool, Space, or
  // middle button) and screen dragging (select tool, isolated mode).
  const onPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const scroller = scrollerRef.current;
      const wrap = wrapRef.current;
      if (!scroller || !wrap) return;

      const pan = panMode || event.button === 1;
      if (!pan && event.button !== 0) return;

      if (pan) {
        event.preventDefault();
        setPanning(true);
        const startX = event.clientX;
        const startY = event.clientY;
        const startLeft = scroller.scrollLeft;
        const startTop = scroller.scrollTop;
        const onMove = (move: PointerEvent) => {
          scroller.scrollLeft = startLeft - (move.clientX - startX);
          scroller.scrollTop = startTop - (move.clientY - startY);
        };
        const onUp = () => {
          setPanning(false);
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        return;
      }

      // Screen dragging: only in isolated mode (a connected panorama is one
      // artboard), and never from an element the user is editing.
      if (!editable || connectedCanvas || tool !== "select") return;
      const target = event.target as HTMLElement;
      if (target.closest(".rnd-editable, [contenteditable], textarea, input, button")) return;
      const screenEl = target.closest<HTMLElement>("[data-screen-id]");
      const slideId = screenEl?.dataset.screenId;
      if (!slideId) return;
      const slide = slides.find((item) => item.id === slideId);
      if (!slide) return;

      const startX = event.clientX;
      const startY = event.clientY;
      const base = slide.canvasOffset ?? { x: 0, y: 0 };
      let moved = false;
      let last = base;

      const onMove = (move: PointerEvent) => {
        const dx = (move.clientX - startX) / scale;
        const dy = (move.clientY - startY) / scale;
        if (!moved && Math.hypot(move.clientX - startX, move.clientY - startY) < DRAG_THRESHOLD) {
          return;
        }
        moved = true;
        last = {
          x: Math.min(cW * 1.5, Math.max(-cW * 1.5, base.x + dx)),
          y: Math.min(cH, Math.max(-cH, base.y + dy)),
        };
        setLiveDrag({ id: slideId, offset: last });
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        if (moved) {
          onScreenOffsetCommit(slideId, last.x === 0 && last.y === 0 ? null : last);
        }
        setLiveDrag(null);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [
      panMode,
      editable,
      connectedCanvas,
      tool,
      slides,
      scale,
      cW,
      cH,
      onScreenOffsetCommit,
    ],
  );

  const cursor = panning ? "grabbing" : panMode ? "grab" : undefined;

  return (
    <div
      ref={containerRef}
      className="dot-grid relative h-full w-full overflow-hidden"
      style={{ cursor }}
    >
      <div
        ref={scrollerRef}
        className="h-full w-full overflow-auto"
        onPointerDown={onPointerDown}
      >
        {/* Generous apron on every side so screens can be arranged freely
            and the workspace pans like an open canvas, not a document. */}
        <div style={{ padding: "38vh 34vw" }}>
          <div
            ref={wrapRef}
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
                editable={editable && !panMode}
                previewScale={scale}
                selectedElement={selectedElement}
                activeSlideId={activeSlide?.id || null}
                showGuides
                offsets={offsets}
                edit={editable && !panMode ? {
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
      </div>

      {/* Context HUD lives bottom-left: the floating design chat owns top-left. */}
      <div className="pointer-events-none absolute bottom-4 left-4 hidden items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-caption text-muted-foreground shadow-sm backdrop-blur-md md:flex">
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

      {/* Zoom cluster clears the floating composer on small screens. */}
      <div className="absolute bottom-36 right-3 flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-1.5 py-1 text-caption tabular-nums text-muted-foreground shadow-sm backdrop-blur-md sm:bottom-4 sm:right-16">
        <span className="px-1">{slides.length}× {cW}×{cH}</span>
        <span aria-hidden className="text-border">|</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setZoom((value) => Math.max(MIN_ZOOM, Number((value / 1.2).toFixed(3))))}
          disabled={zoom <= MIN_ZOOM}
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
          onClick={() => setZoom((value) => Math.min(MAX_ZOOM, Number((value * 1.2).toFixed(3))))}
          disabled={zoom >= MAX_ZOOM}
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
