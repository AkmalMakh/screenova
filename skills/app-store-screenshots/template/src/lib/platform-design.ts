import { CANVAS } from "./constants";
import { DEFAULT_PROJECT, nid } from "./defaults";
import type { Device, ElementTransform, Orientation, ProjectState, Slide } from "./types";

// iOS and Android decks are stored per device. A deck designed for one store
// should carry to the other: phone ↔ phone, tablet ↔ tablet.
export function counterpartDevice(device: Device, orientation: Orientation = "portrait"): Device | null {
  // iPad has no landscape canvas, so landscape Android tablets have no counterpart.
  if (orientation === "landscape" && (device === "ipad" || device === "android-7" || device === "android-10")) return null;
  switch (device) {
    case "iphone": return "android";
    case "android": return "iphone";
    case "ipad": return "android-10";
    case "android-7":
    case "android-10": return "ipad";
    default: return null;
  }
}

function canvasSize(device: Device, orientation: Orientation) {
  const c = CANVAS[device];
  return orientation === "landscape" && c.wL && c.hL ? { w: c.wL, h: c.hL } : { w: c.w, h: c.h };
}

/** Slide content with every id removed, for comparing against the starter. */
function shape(slides: Slide[]) {
  return JSON.stringify(slides, (key, value) => (key === "id" ? undefined : value));
}

/** True while a device still shows the untouched starter deck. */
export function isStarterDeck(device: Device, slides: Slide[] | undefined): boolean {
  if (!slides?.length) return true;
  return shape(slides) === shape(DEFAULT_PROJECT.slidesByDevice[device]);
}

/**
 * Re-fit a deck designed on one canvas to another. Element centers keep their
 * relative position on each axis; sizes and type scale by the mean of the two
 * axis factors so text stays readable when the aspect ratio changes.
 */
export function adaptSlides(
  slides: Slide[],
  from: Device,
  to: Device,
  orientation: Orientation,
  makeId: () => string = nid,
): Slide[] {
  const src = canvasSize(from, orientation);
  const dst = canvasSize(to, orientation);
  const sx = dst.w / src.w;
  const sy = dst.h / src.h;
  const s = (sx + sy) / 2;

  const fit = (t: ElementTransform): ElementTransform => {
    const width = t.width * s;
    const height = t.height * s;
    let x = (t.x + t.width / 2) * sx - width / 2;
    let y = (t.y + t.height / 2) * sy - height / 2;
    // Elements that sat fully inside the source canvas stay inside the target;
    // deliberate bleeds (blobs off the edge) keep their overhang.
    if (t.x >= 0 && t.x + t.width <= src.w) x = Math.min(Math.max(x, 0), dst.w - width);
    if (t.y >= 0 && t.y + t.height <= src.h) y = Math.min(Math.max(y, 0), dst.h - height);
    return { ...t, x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
  };
  const size = (value: number | undefined, min: number, max: number) =>
    value === undefined ? undefined : Math.min(max, Math.max(min, Math.round(value * s)));

  return slides.map((slide) => {
    const { canvasOffset: _offset, ...rest } = slide;
    const next: Slide = { ...rest, id: makeId() };
    if (slide.transforms) {
      next.transforms = Object.fromEntries(
        Object.entries(slide.transforms).map(([key, t]) => [key, t ? fit(t) : t]),
      ) as Slide["transforms"];
    }
    if (slide.headlineStyle) {
      next.headlineStyle = { ...slide.headlineStyle, fontSize: size(slide.headlineStyle.fontSize, 20, 250)! };
    }
    if (slide.textElements) {
      next.textElements = slide.textElements.map((el) => ({
        ...el,
        transform: fit(el.transform),
        ...(el.fontSize !== undefined ? { fontSize: size(el.fontSize, 8, 400) } : {}),
      }));
    }
    if (slide.decorations) {
      next.decorations = slide.decorations.map((el) => ({
        ...el,
        transform: fit(el.transform),
        ...(el.borderRadius !== undefined ? { borderRadius: size(el.borderRadius, 0, 2000) } : {}),
        ...(el.blur !== undefined ? { blur: size(el.blur, 0, 400) } : {}),
      }));
    }
    return next;
  });
}

/** Copy the counterpart device's design (slides and AI palette) onto `device`. */
export function withCounterpartDesign(state: ProjectState, device: Device): ProjectState {
  const from = counterpartDevice(device, state.orientation);
  if (!from) return state;
  const source = state.slidesByDevice[from];
  if (!source?.length) return state;
  const theme = state.customThemesByDevice?.[from];
  return {
    ...state,
    slidesByDevice: { ...state.slidesByDevice, [device]: adaptSlides(source, from, device, state.orientation) },
    ...(theme
      ? { customThemesByDevice: { ...state.customThemesByDevice, [device]: { ...theme, id: `ai-custom-${device}` } } }
      : {}),
  };
}

/**
 * Switching devices: an untouched deck adopts the counterpart's design, so an
 * iPhone deck shows up on Android ready to export. Edited decks are kept.
 */
export function switchDevice(state: ProjectState, device: Device): ProjectState {
  const next = { ...state, device };
  const from = counterpartDevice(device, state.orientation);
  if (!from || !isStarterDeck(device, state.slidesByDevice[device]) || isStarterDeck(from, state.slidesByDevice[from])) {
    return next;
  }
  return withCounterpartDesign(next, device);
}
