"use client";
import * as React from "react";

// Which floating panels the editor shows. The left slot holds either the
// screens list or the design chat (never both: they share the same place);
// the inspector sits on the right.
export type LeftPanel = "screens" | "chat" | null;
export type EditorLayout = { left: LeftPanel; inspector: boolean };

export const EDITOR_LAYOUT_KEY = "screenova:editor-layout:v1";
const PHONE_MAX = 640;

// Manual-first (DESIGN.md: never hide manual editing). Panels open where
// they leave the canvas room to work; phones start clean and open one sheet
// at a time.
export function defaultEditorLayout(viewportWidth: number): EditorLayout {
  if (viewportWidth >= 1024) return { left: "screens", inspector: true };
  if (viewportWidth >= PHONE_MAX) return { left: "screens", inspector: false };
  return { left: null, inspector: false };
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
  return parseEditorLayout(stored) ?? defaultEditorLayout(width);
}

const isPhone = () => typeof window !== "undefined" && window.innerWidth < PHONE_MAX;

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

  const showLeft = React.useCallback((left: LeftPanel) => {
    setLayout((current) => ({
      left,
      // Phones show one sheet at a time.
      inspector: left && isPhone() ? false : current.inspector,
    }));
  }, []);

  const toggleLeft = React.useCallback((panel: Exclude<LeftPanel, null>) => {
    setLayout((current) => {
      const left = current.left === panel ? null : panel;
      return { left, inspector: left && isPhone() ? false : current.inspector };
    });
  }, []);

  const setInspector = React.useCallback((open: boolean | ((current: boolean) => boolean)) => {
    setLayout((current) => {
      const inspector = typeof open === "function" ? open(current.inspector) : open;
      return { left: inspector && isPhone() ? null : current.left, inspector };
    });
  }, []);

  return { layout, showLeft, toggleLeft, setInspector };
}
