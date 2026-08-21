"use client";
import * as React from "react";
import { flushSync } from "react-dom";
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

export type CanvasTool = "select" | "marquee" | "pan";

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
  /** Screens marked on the canvas — shared with the AI "selected screens"
      scope and the Screens panel checkmarks. */
  selectedIds: ReadonlySet<string>;
  onSelectedIdsChange: (ids: Set<string>) => void;
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
  selectedIds,
  onSelectedIdsChange,
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
  // Hot paths (screen drag, marquee band) bypass React entirely: pointermove
  // writes transforms and overlay geometry straight to the DOM at rAF rate,
  // and state is committed exactly once on release. Rendering the 9-screen
  // deck per mousemove is what made dragging feel heavy.
  const marqueeBandRef = React.useRef<HTMLDivElement>(null);
  const markOverlayRef = React.useRef<HTMLDivElement>(null);
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
    return map;
  }, [slides]);

  // Screen rectangles in client coordinates — the marquee's hit-test space.
  const screenRects = React.useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return [];
    const rect = wrap.getBoundingClientRect();
    return slides.map((slide, index) => {
      const off = (!connectedCanvas && slide.canvasOffset) || { x: 0, y: 0 };
      return {
        id: slide.id,
        left: rect.left + (index * cW + off.x) * scale,
        top: rect.top + off.y * scale,
        width: cW * scale,
        height: cH * scale,
      };
    });
  }, [slides, connectedCanvas, cW, cH, scale]);

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
      } else if (event.key === "m" || event.key === "M") {
        onToolChange("marquee");
      } else if (event.key === "h" || event.key === "H") {
        onToolChange("pan");
      } else if (event.key === "Escape") {
        if (selectedIds.size) onSelectedIdsChange(new Set());
      } else if (
        event.key.startsWith("Arrow") &&
        selectedIds.size &&
        !connectedCanvas &&
        editable
      ) {
        // Nudge the marked screens: 16 canvas px, Shift = 64.
        event.preventDefault();
        const step = event.shiftKey ? 64 : 16;
        const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
        const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
        for (const slide of slides) {
          if (!selectedIds.has(slide.id)) continue;
          const base = slide.canvasOffset ?? { x: 0, y: 0 };
          const next = {
            x: Math.min(cW * 1.5, Math.max(-cW * 1.5, base.x + dx)),
            y: Math.min(cH, Math.max(-cH, base.y + dy)),
          };
          onScreenOffsetCommit(slide.id, next.x === 0 && next.y === 0 ? null : next);
        }
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
  }, [
    onToolChange,
    selectedIds,
    onSelectedIdsChange,
    connectedCanvas,
    editable,
    slides,
    cW,
    cH,
    onScreenOffsetCommit,
  ]);

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

  // One pointer handler covers all three gestures: pan (hand tool, Space,
  // middle button), marquee marking, and screen dragging (single or group).
  const onPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const scroller = scrollerRef.current;
      const container = containerRef.current;
      if (!scroller || !container) return;

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

      // Mark tool: rubber-band over the canvas; screens touching the band
      // become the selection. The band and the live highlight rings are drawn
      // directly into the DOM — React only hears about it once, on release.
      if (tool === "marquee") {
        event.preventDefault();
        const containerRect = container.getBoundingClientRect();
        const band = marqueeBandRef.current;
        const overlay = markOverlayRef.current;
        const startX = event.clientX;
        const startY = event.clientY;
        const additive = event.shiftKey ? new Set(selectedIds) : new Set<string>();
        const rects = screenRects();
        let hits = new Set(additive);
        let moved = false;
        let raf = 0;
        let lastX = startX;
        let lastY = startY;

        const paintFrame = () => {
          raf = 0;
          const left = Math.min(startX, lastX);
          const top = Math.min(startY, lastY);
          const right = Math.max(startX, lastX);
          const bottom = Math.max(startY, lastY);

          hits = new Set(additive);
          for (const rect of rects) {
            const hit =
              rect.left < right &&
              rect.left + rect.width > left &&
              rect.top < bottom &&
              rect.top + rect.height > top;
            if (hit) hits.add(rect.id);
          }

          if (band) {
            band.style.display = "block";
            band.style.left = `${left - containerRect.left}px`;
            band.style.top = `${top - containerRect.top}px`;
            band.style.width = `${right - left}px`;
            band.style.height = `${bottom - top}px`;
          }
          if (overlay) {
            // One highlight box per hit screen, rebuilt per frame (cheap: <10 nodes).
            overlay.replaceChildren(
              ...[...hits].flatMap((id) => {
                const rect = rects.find((item) => item.id === id);
                if (!rect) return [];
                const box = document.createElement("div");
                box.style.cssText =
                  "position:absolute;pointer-events:none;border:2px solid rgba(0,113,230,0.75);" +
                  "background:rgba(0,113,230,0.05);border-radius:2px;";
                box.style.left = `${rect.left - containerRect.left}px`;
                box.style.top = `${rect.top - containerRect.top}px`;
                box.style.width = `${rect.width}px`;
                box.style.height = `${rect.height}px`;
                return [box];
              }),
            );
          }
        };

        const onMove = (move: PointerEvent) => {
          lastX = move.clientX;
          lastY = move.clientY;
          if (!moved && Math.hypot(lastX - startX, lastY - startY) < DRAG_THRESHOLD) return;
          moved = true;
          if (!raf) raf = requestAnimationFrame(paintFrame);
        };
        const onUp = (up: PointerEvent) => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          if (raf) cancelAnimationFrame(raf);
          if (band) band.style.display = "none";
          overlay?.replaceChildren();
          if (moved) {
            onSelectedIdsChange(hits);
            return;
          }
          // A plain click marks the screen under the cursor (or clears).
          const hit = [...rects].reverse().find(
            (rect) =>
              up.clientX >= rect.left &&
              up.clientX <= rect.left + rect.width &&
              up.clientY >= rect.top &&
              up.clientY <= rect.top + rect.height,
          );
          const next = new Set(additive);
          if (hit) {
            if (event.shiftKey && selectedIds.has(hit.id)) next.delete(hit.id);
            else next.add(hit.id);
          }
          onSelectedIdsChange(next);
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        return;
      }

      // Select tool. Never steal the pointer from an element being edited.
      const target = event.target as HTMLElement;
      if (target.closest(".rnd-editable, [contenteditable], textarea, input, button")) return;
      const screenEl = target.closest<HTMLElement>("[data-screen-id]");
      const slideId = screenEl?.dataset.screenId;

      // Click on empty canvas clears the marked set.
      if (!slideId) {
        if (selectedIds.size) {
          const sx = event.clientX;
          const sy = event.clientY;
          const onUp = (up: PointerEvent) => {
            window.removeEventListener("pointerup", onUp);
            if (Math.hypot(up.clientX - sx, up.clientY - sy) < DRAG_THRESHOLD) {
              onSelectedIdsChange(new Set());
            }
          };
          window.addEventListener("pointerup", onUp);
        }
        return;
      }

      // Shift+click toggles a screen in and out of the marked set.
      if (event.shiftKey) {
        const next = new Set(selectedIds);
        if (next.has(slideId)) next.delete(slideId);
        else next.add(slideId);
        onSelectedIdsChange(next);
        return;
      }

      // Screen dragging: isolated mode only (a connected panorama is one
      // artboard). Dragging a marked screen moves the whole marked group.
      // The move itself is pure compositor work: rAF-throttled translate()
      // on the screen nodes, with will-change and a shadow lift. React sees
      // one flushSync commit on release, timed so there is no snap-back frame.
      if (!editable || connectedCanvas) return;
      const groupIds =
        selectedIds.has(slideId) && selectedIds.size > 0 ? [...selectedIds] : [slideId];
      const bases = new Map<string, Offset>();
      for (const id of groupIds) {
        const slide = slides.find((item) => item.id === id);
        if (slide) bases.set(id, slide.canvasOffset ?? { x: 0, y: 0 });
      }
      if (!bases.size) return;

      // Rigid-group clamp: limit the shared delta so no member crosses the
      // canvas bounds — the group never tears apart at the edges.
      let minDx = -Infinity, maxDx = Infinity, minDy = -Infinity, maxDy = Infinity;
      for (const base of bases.values()) {
        minDx = Math.max(minDx, -cW * 1.5 - base.x);
        maxDx = Math.min(maxDx, cW * 1.5 - base.x);
        minDy = Math.max(minDy, -cH - base.y);
        maxDy = Math.min(maxDy, cH - base.y);
      }

      const nodes = new Map<string, HTMLElement[]>();
      for (const id of bases.keys()) {
        nodes.set(id, [
          ...container.querySelectorAll<HTMLElement>(`[data-screen-id="${id}"]`),
        ]);
      }

      const startX = event.clientX;
      const startY = event.clientY;
      let moved = false;
      let raf = 0;
      let lastX = startX;
      let lastY = startY;
      let dx = 0;
      let dy = 0;

      const lift = () => {
        document.body.style.cursor = "grabbing";
        for (const els of nodes.values()) {
          for (const el of els) {
            el.style.willChange = "transform";
            el.style.zIndex = "5";
          }
          // Shadow on the first node (the background card) is enough lift.
          const first = els[0];
          if (first) first.style.filter = "drop-shadow(0 24px 48px rgba(10,12,20,0.28))";
        }
      };

      const paintFrame = () => {
        raf = 0;
        dx = Math.min(maxDx, Math.max(minDx, (lastX - startX) / scale));
        dy = Math.min(maxDy, Math.max(minDy, (lastY - startY) / scale));
        for (const els of nodes.values()) {
          for (const el of els) {
            el.style.transform = `translate(${dx}px, ${dy}px)`;
          }
        }
      };

      const onMove = (move: PointerEvent) => {
        lastX = move.clientX;
        lastY = move.clientY;
        if (!moved) {
          if (Math.hypot(lastX - startX, lastY - startY) < DRAG_THRESHOLD) return;
          moved = true;
          lift();
        }
        if (!raf) raf = requestAnimationFrame(paintFrame);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        if (raf) cancelAnimationFrame(raf);
        document.body.style.cursor = "";
        if (moved) {
          paintFrame();
          // Commit synchronously so the new left/top land in the same frame
          // the inline transforms are cleared — no double-offset flash.
          flushSync(() => {
            for (const [id, base] of bases) {
              const next = { x: base.x + dx, y: base.y + dy };
              onScreenOffsetCommit(id, next.x === 0 && next.y === 0 ? null : next);
            }
          });
        }
        for (const els of nodes.values()) {
          for (const el of els) {
            el.style.transform = "";
            el.style.willChange = "";
            el.style.zIndex = "";
            el.style.filter = "";
          }
        }
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [
      panMode,
      tool,
      selectedIds,
      onSelectedIdsChange,
      screenRects,
      editable,
      connectedCanvas,
      slides,
      scale,
      cW,
      cH,
      onScreenOffsetCommit,
    ],
  );

  const stageEditable = editable && !panMode && tool !== "marquee";
  const cursor = panning ? "grabbing" : panMode ? "grab" : tool === "marquee" ? "crosshair" : undefined;

  return (
    <div
      ref={containerRef}
      data-tool={tool}
      data-freeform={!connectedCanvas && editable ? "true" : undefined}
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
                editable={stageEditable}
                previewScale={scale}
                selectedElement={selectedElement}
                activeSlideId={activeSlide?.id || null}
                showGuides
                offsets={offsets}
                selectedScreenIds={selectedIds}
                edit={stageEditable ? {
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

      {/* Direct-DOM layers for the mark tool: live highlight rings + band.
          Painted at rAF rate during a drag; React never renders mid-gesture. */}
      <div ref={markOverlayRef} aria-hidden className="pointer-events-none absolute inset-0 z-20" />
      <div
        ref={marqueeBandRef}
        aria-hidden
        className="pointer-events-none absolute z-20 hidden rounded-xs border border-primary/70 bg-primary/10"
        style={{ display: "none" }}
      />

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
