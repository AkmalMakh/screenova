import { describe, expect, it } from "vitest";
import {
  chromeGeometry,
  defaultEditorLayout,
  fitLayoutToWidth,
  parseEditorLayout,
} from "./use-editor-layout";

describe("defaultEditorLayout", () => {
  it("opens the screens list and the inspector on laptops and desktops", () => {
    expect(defaultEditorLayout(1024)).toEqual({ left: "screens", inspector: true });
    expect(defaultEditorLayout(1440)).toEqual({ left: "screens", inspector: true });
  });

  it("keeps the canvas usable on tablets: screens only", () => {
    expect(defaultEditorLayout(768)).toEqual({ left: "screens", inspector: false });
  });

  it("starts phones with no sheet open", () => {
    expect(defaultEditorLayout(390)).toEqual({ left: null, inspector: false });
  });

  it("never defaults to the AI chat: manual editing comes first", () => {
    for (const width of [390, 768, 1024, 1920]) {
      expect(defaultEditorLayout(width).left).not.toBe("chat");
    }
  });
});

describe("parseEditorLayout", () => {
  it("restores a remembered layout", () => {
    expect(parseEditorLayout('{"left":"chat","inspector":false}')).toEqual({
      left: "chat",
      inspector: false,
    });
    expect(parseEditorLayout('{"left":null,"inspector":true}')).toEqual({
      left: null,
      inspector: true,
    });
  });

  it("rejects missing, malformed or foreign values", () => {
    expect(parseEditorLayout(null)).toBeNull();
    expect(parseEditorLayout("not json")).toBeNull();
    expect(parseEditorLayout('{"left":"screens"}')).toBeNull();
    expect(parseEditorLayout('{"left":"layers","inspector":true}')).toEqual({
      left: null,
      inspector: true,
    });
  });
});

describe("fitLayoutToWidth", () => {
  it("keeps both side panels where there is room", () => {
    const both = { left: "screens" as const, inspector: true };
    expect(fitLayoutToWidth(both, 1280)).toBe(both);
  });

  it("drops the inspector below 1024px so the canvas is not squeezed", () => {
    expect(fitLayoutToWidth({ left: "screens", inspector: true }, 900)).toEqual({
      left: "screens",
      inspector: false,
    });
    expect(fitLayoutToWidth({ left: null, inspector: true }, 900)).toEqual({
      left: null,
      inspector: true,
    });
  });
});

describe("chromeGeometry", () => {
  const both = { left: "screens" as const, inspector: true };

  it("puts the composer between the panels and runs them full height when it fits", () => {
    const g = chromeGeometry(1440, both, 120, true);
    expect(g.composer.left).toBe(g.leftEdge + 16);
    expect(g.composer.right).toBe(g.rightEdge + 16);
    expect(g.panelBottom).toBe(16);
    expect(g.canvas).toEqual({ top: 0, right: g.rightEdge, bottom: 140, left: g.leftEdge });
  });

  it("spans the composer and stops the panels above it when the gap is too narrow", () => {
    const g = chromeGeometry(900, both, 120, true);
    expect(g.composer).toEqual({ left: 16, right: 16 });
    expect(g.panelBottom).toBe(20 + 120 + 16);
  });

  it("never lets the inspector overlap the left panel or the rail", () => {
    for (const width of [1024, 1280, 1440, 1920]) {
      const g = chromeGeometry(width, both, 120, true);
      expect(width - g.rightEdge).toBeGreaterThan(g.leftEdge);
      expect(g.inspectorRight).toBeGreaterThanOrEqual(12 + 46);
    }
  });

  it("gives phones the whole canvas: panels there are sheets", () => {
    expect(chromeGeometry(390, both, 120, true).canvas).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });
});
