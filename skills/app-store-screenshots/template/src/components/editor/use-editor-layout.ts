"use client";
import * as React from "react";

// Which floating panels the editor shows. The left slot holds either the
// screens list or the design chat (never both: they share the same place);
// the inspector sits on the right.
export type LeftPanel = "screens" | "chat" | null;
export type EditorLayout = { left: LeftPanel; inspector: boolean };

export const EDITOR_LAYOUT_KEY = "screenova:editor-layout:v1";
const PHONE_MAX = 640;
// Below this, the screens list and the inspector together would squeeze the
// canvas (DESIGN.md: reflow panels before controls become cramped), so the
// editor shows one side panel at a time.
const ROOMY_MIN = 1024;

// Manual-first (DESIGN.md: never hide manual editing). Panels open where
// they leave the canvas room to work; phones start clean and open one sheet
// at a time.
export function defaultEditorLayout(viewportWidth: number): EditorLayout {
  if (viewportWidth >= 1024) return { left: "screens", inspector: true };
  if (viewportWidth >= PHONE_MAX) return { left: "screens", inspector: false };
  return { left: null, inspector: false };
}

// One side panel at a time where there is no room for two.
export function fitLayoutToWidth(layout: EditorLayout, viewportWidth: number): EditorLayout {
  if (viewportWidth >= ROOMY_MIN || !layout.left || !layout.inspector) return layout;
  return { left: layout.left, inspector: false };
}

export function parseEditorLayout(raw: string | null): EditorLayout | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<EditorLayout>;
    const left = value.left === "screens" || value.left === "chat" ? value.left : null;
    if (typeof value.inspector !== "boolean") return null;
    return { left, inspector: value.inspector };
  } catch {
    return null;
  }
}

function initialLayout(): EditorLayout {
  if (typeof window === "undefined") return { left: null, inspector: false };
  const width = window.innerWidth;
  // A layout remembered on a desktop never opens as stacked sheets on a phone.
  if (width < PHONE_MAX) return defaultEditorLayout(width);
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(EDITOR_LAYOUT_KEY);
  } catch {
    // Private mode or blocked storage: fall back to the default.
  }
  return fitLayoutToWidth(parseEditorLayout(stored) ?? defaultEditorLayout(width), width);
}

const isCramped = () => typeof window !== "undefined" && window.innerWidth < ROOMY_MIN;
const isPhone = () => typeof window !== "undefined" && window.innerWidth < PHONE_MAX;

// One description of the floating chrome, shared by the panels, the AI
// composer, the canvas HUD and the canvas fit, so nothing can land on top of
// anything else. All values are px within the editor area (below the toolbar).
export const CHROME = {
  edge: 16,
  screensW: 184,
  chatW: 320,
  railRight: 12,
  railW: 46,
  railGap: 12,
  inspectorW: 250,
  composerBottom: 20,
  composerMin: 400,
  composerMax: 640,
} as const;

export type Insets = { top: number; right: number; bottom: number; left: number };
export type ChromeGeometry = {
  phone: boolean;
  /** Distance from the area's left edge to the left panel's right edge (0 = none). */
  leftEdge: number;
  /** Distance from the area's right edge to the inspector's (or rail's) left edge. */
  rightEdge: number;
  inspectorRight: number;
  /** Bottom offset for the side panels: full height, or above a spanning composer. */
  panelBottom: number;
  composer: { left: number; right: number };
  /** The unobstructed part of the canvas, for fitting and centering. */
  canvas: Insets;
};

export function chromeGeometry(
  areaWidth: number,
  layout: EditorLayout,
  composerHeight: number,
  composerVisible: boolean,
): ChromeGeometry {
  const c = CHROME;
  const railEdge = c.railRight + c.railW;
  const inspectorRight = railEdge + c.railGap;
  if (areaWidth < PHONE_MAX) {
    // Phones: panels are sheets over the canvas; the canvas uses the full area.
    return {
      phone: true,
      leftEdge: 0,
      rightEdge: 0,
      inspectorRight,
      panelBottom: c.edge,
      composer: { left: 12, right: 12 },
      canvas: { top: 0, right: 0, bottom: 0, left: 0 },
    };
  }
  const leftEdge = layout.left
    ? c.edge + (layout.left === "chat" ? c.chatW : c.screensW)
    : 0;
  const rightEdge = layout.inspector ? inspectorRight + c.inspectorW : railEdge;
  const between = areaWidth - leftEdge - rightEdge - c.edge * 2;
  const composerBlock = composerVisible ? c.composerBottom + composerHeight : 0;
  // Enough room between the panels: the composer sits there and the panels
  // run full height. Otherwise it spans the bottom and the panels stop above.
  const spanning = composerVisible && between < c.composerMin;
  return {
    phone: false,
    leftEdge,
    rightEdge,
    inspectorRight,
    panelBottom: spanning ? composerBlock + c.edge : c.edge,
    composer: spanning
      ? { left: c.edge, right: c.edge }
      : { left: leftEdge + c.edge, right: rightEdge + c.edge },
    canvas: { top: 0, right: rightEdge, bottom: composerBlock, left: leftEdge },
  };
}

// Border-box size of an element, kept current with a ResizeObserver. A
// callback ref, because the editor mounts its chrome after a loading screen.
export function useElementSize<T extends HTMLElement>() {
  const [el, ref] = React.useState<T | null>(null);
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  React.useEffect(() => {
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize((current) =>
        current.width === rect.width && current.height === rect.height
          ? current
          : { width: rect.width, height: rect.height },
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [el]);
  return [ref, size] as const;
}

export function useEditorLayout() {
  const [layout, setLayout] = React.useState<EditorLayout>(initialLayout);

  React.useEffect(() => {
    if (isPhone()) return;
    try {
      window.localStorage.setItem(EDITOR_LAYOUT_KEY, JSON.stringify(layout));
    } catch {
      // Remembering the layout is a convenience; never fail the editor over it.
    }
  }, [layout]);

  // Shrinking the window below the two-panel width keeps the left panel.
  React.useEffect(() => {
    const onResize = () =>
      setLayout((current) => {
        const next = fitLayoutToWidth(current, window.innerWidth);
        return next === current ? current : next;
      });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const showLeft = React.useCallback((left: LeftPanel) => {
    setLayout((current) => ({
      left,
      // Narrow windows show one side panel at a time.
      inspector: left && isCramped() ? false : current.inspector,
    }));
  }, []);

  const toggleLeft = React.useCallback((panel: Exclude<LeftPanel, null>) => {
    setLayout((current) => {
      const left = current.left === panel ? null : panel;
      return { left, inspector: left && isCramped() ? false : current.inspector };
    });
  }, []);

  const setInspector = React.useCallback((open: boolean | ((current: boolean) => boolean)) => {
    setLayout((current) => {
      const inspector = typeof open === "function" ? open(current.inspector) : open;
      return { left: inspector && isCramped() ? null : current.left, inspector };
    });
  }, []);

  return { layout, showLeft, toggleLeft, setInspector };
}
