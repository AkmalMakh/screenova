"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

type Rect = { x: number; y: number; w: number; h: number };

// The selected segment's box inside a segmented control, kept current on
// resize. Active segments are found by their own state attributes, so this
// works for Radix tabs (data-state), toggle groups (aria-pressed) and radios.
export function useSegmentThumb<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);
  const [rect, setRect] = React.useState<Rect | null>(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const active = el.querySelector<HTMLElement>(
        '[data-state="active"], [aria-pressed="true"], [aria-checked="true"]',
      );
      setRect(
        active
          ? { x: active.offsetLeft, y: active.offsetTop, w: active.offsetWidth, h: active.offsetHeight }
          : null,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    // Selection changes arrive as attribute flips on the segments.
    const mutations = new MutationObserver(measure);
    mutations.observe(el, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-state", "aria-pressed", "aria-checked"],
    });
    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, []);
  return [ref, rect] as const;
}

// The sliding selection behind a segmented control (DESIGN.md: segmented
// thumbs may be pills; motion explains the selection change). It glides on
// the move curve; a freshly mounted control simply appears in place.
export function SegmentThumb({ rect, className }: { rect: Rect | null; className?: string }) {
  if (!rect) return null;
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute left-0 top-0 rounded-xs bg-card shadow-sm ring-1 ring-black/[0.04] transition-[transform,width,height] duration-short ease-move dark:bg-accent dark:ring-white/[0.06]",
        className,
      )}
      style={{ transform: `translate(${rect.x}px, ${rect.y}px)`, width: rect.w, height: rect.h }}
    />
  );
}
