"use client";
import * as React from "react";
import { themeById } from "@/lib/constants";
import type { ProjectState } from "@/lib/types";
import { DeckCanvas, SlideCanvas, getCanvas } from "@/components/editor/slide-canvas";

// The first screens of a project, drawn from its real content (DESIGN.md:
// project previews must reflect their actual content). Static, non-editable.
export function ProjectPreview({
  project,
  height,
  max = 3,
}: {
  project: ProjectState | undefined;
  height: number;
  max?: number;
}) {
  const device = project?.device ?? "iphone";
  const orientation = project?.orientation ?? "portrait";
  const slides = (project?.slidesByDevice?.[device] || []).slice(0, max);
  if (!project || slides.length === 0) return null;
  const theme =
    project.customThemesByDevice?.[device] || themeById(project.themeId, project.customTheme);
  const { cW, cH } = getCanvas(device, orientation);
  const scale = height / cH;
  const width = Math.round(cW * scale);
  if (project.connectedCanvas) {
    // A connected deck is one panorama: show it as one continuous strip.
    return (
      <span
        aria-hidden
        className="relative block shrink-0 overflow-hidden rounded-xs bg-muted shadow-sm ring-1 ring-black/[0.06]"
        style={{ width: width * slides.length, height }}
      >
        <span
          className="pointer-events-none absolute left-0 top-0 block origin-top-left"
          style={{ width: cW * slides.length, height: cH, transform: `scale(${scale})` }}
        >
          <DeckCanvas
            slides={slides}
            device={device}
            orientation={orientation}
            theme={theme}
            locale={project.locale}
            appName={project.appName}
            appIcon={project.appIcon}
            connectedCanvas
            editable={false}
            hideEmpty
          />
        </span>
      </span>
    );
  }
  return (
    <span aria-hidden className="flex items-end gap-1.5">
      {slides.map((slide) => (
        <span
          key={slide.id}
          className="relative block shrink-0 overflow-hidden rounded-xs bg-muted shadow-sm ring-1 ring-black/[0.06]"
          style={{ width, height }}
        >
          <span
            className="pointer-events-none absolute left-0 top-0 block origin-top-left"
            style={{ width: cW, height: cH, transform: `scale(${scale})` }}
          >
            <SlideCanvas
              slide={slide}
              device={device}
              orientation={orientation}
              theme={theme}
              locale={project.locale}
              appName={project.appName}
              appIcon={project.appIcon}
              editable={false}
              hideEmpty
            />
          </span>
        </span>
      ))}
    </span>
  );
}
