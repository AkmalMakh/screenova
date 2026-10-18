import { describe, expect, it } from "vitest";
import { defaultEditorLayout, parseEditorLayout } from "./use-editor-layout";

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
