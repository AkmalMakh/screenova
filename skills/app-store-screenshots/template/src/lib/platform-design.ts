import { CANVAS } from "./constants";
import { DEFAULT_PROJECT, detectPlatform, nid } from "./defaults";
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

/**
 * Slide content with every id removed and keys sorted, for comparing against
 * the starter: a deck read back from the database has its keys reordered.
 */
function shape(slides: Slide[]) {
  return JSON.stringify(slides, (key, value) => {
    if (key === "id") return undefined;
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)));
  });
}

// Starter screens in other languages can come from the starter's own
// translations or from an AI translation of the whole project, in any
// wording, so only the English copy and the structure identify a starter.
const englishOnly = (slides: Slide[]) =>
  slides.map((slide) => ({ ...slide, label: { en: slide.label?.en ?? "" }, headline: { en: slide.headline?.en ?? "" } }));

/** True while a device still shows the untouched starter deck. */
export function isStarterDeck(device: Device, slides: Slide[] | undefined): boolean {
  if (!slides?.length) return true;
  return shape(englishOnly(slides)) === shape(englishOnly(DEFAULT_PROJECT.slidesByDevice[device]));
}

/**
 * Re-fit a deck designed on one canvas to another. Element centers keep their
 * relative position on each axis; sizes and type scale by the mean of the two
 * axis factors so text stays readable when the aspect ratio changes.
 *
 * reflowText is for a big change of shape (phone to tablet): text boxes
 * stretch with the canvas on each axis while type scales by the smaller
 * factor, so lines wrap less instead of growing into the block below.
 */
export function adaptSlides(
  slides: Slide[],
  from: Device,
  to: Device,
  orientation: Orientation,
  makeId: () => string = nid,
  { reflowText = false }: { reflowText?: boolean } = {},
): Slide[] {
  const src = canvasSize(from, orientation);
  const dst = canvasSize(to, orientation);
  const sx = dst.w / src.w;
  const sy = dst.h / src.h;
  const s = (sx + sy) / 2;
  const typeScale = reflowText ? Math.min(sx, sy) : s;

  const fit = (t: ElementTransform, box = false): ElementTransform => {
    const width = t.width * (box ? sx : s);
    const height = t.height * (box ? sy : s);
    let x = (t.x + t.width / 2) * sx - width / 2;
    let y = (t.y + t.height / 2) * sy - height / 2;
    // Elements that sat fully inside the source canvas stay inside the target;
    // deliberate bleeds (blobs off the edge) keep their overhang.
    if (t.x >= 0 && t.x + t.width <= src.w) x = Math.min(Math.max(x, 0), dst.w - width);
    if (t.y >= 0 && t.y + t.height <= src.h) y = Math.min(Math.max(y, 0), dst.h - height);
    return { ...t, x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
  };
  const size = (value: number | undefined, min: number, max: number, factor = s) =>
    value === undefined ? undefined : Math.min(max, Math.max(min, Math.round(value * factor)));

  return slides.map((slide) => {
    const { canvasOffset: _offset, ...rest } = slide;
    const next: Slide = { ...rest, id: makeId() };
    if (slide.transforms) {
      next.transforms = Object.fromEntries(
        Object.entries(slide.transforms).map(([key, t]) => [key, t ? fit(t, reflowText && key === "caption") : t]),
      ) as Slide["transforms"];
    }
    if (slide.headlineStyle) {
      next.headlineStyle = { ...slide.headlineStyle, fontSize: size(slide.headlineStyle.fontSize, 20, 250, typeScale)! };
    }
    if (slide.textElements) {
      next.textElements = slide.textElements.map((el) => ({
        ...el,
        transform: fit(el.transform, reflowText),
        ...(el.fontSize !== undefined ? { fontSize: size(el.fontSize, 8, 400, typeScale) } : {}),
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

export function formFactor(device: Device): "phone" | "tablet" | "other" {
  if (device === "iphone" || device === "android") return "phone";
  if (device === "ipad" || device === "android-7" || device === "android-10") return "tablet";
  return "other";
}

/**
 * Where an untouched deck takes its design from: the same form factor on the
 * other store first, then, for a tablet, whichever phone deck is designed
 * (same store first). Null when nothing designed fits.
 */
export function designSource(state: ProjectState, device: Device): Device | null {
  const designed = (candidate: Device) => !isStarterDeck(candidate, state.slidesByDevice[candidate]);
  const counterpart = counterpartDevice(device, state.orientation);
  if (counterpart && designed(counterpart)) return counterpart;
  if (formFactor(device) !== "tablet" || state.orientation === "landscape") return null;
  const phones: Device[] = detectPlatform(device) === "ios" ? ["iphone", "android"] : ["android", "iphone"];
  return phones.find(designed) ?? null;
}

// A phone screenshot doesn't fit a tablet frame, and the phone's frame
// placement doesn't fit the tablet's shape: keep the look, empty the screens,
// and let the layout place the tablet.
function withEmptyScreens(slide: Slide): Slide {
  const { screenshotSecondary: _secondary, screenshotByLocale: _byLocale, screenshotSecondaryByLocale: _secondaryByLocale, transforms, ...rest } = slide;
  const { device: _device, deviceSecondary: _deviceSecondary, ...kept } = transforms ?? {};
  return { ...rest, screenshot: "", ...(Object.keys(kept).length ? { transforms: kept } : {}) };
}

/** Copy `from`'s design (slides and AI palette) onto `device`. */
export function withDesignFrom(state: ProjectState, device: Device, from: Device): ProjectState {
  const source = state.slidesByDevice[from];
  if (!source?.length) return state;
  const crossing = formFactor(from) !== formFactor(device);
  const adapted = adaptSlides(source, from, device, state.orientation, nid, { reflowText: crossing });
  const slides = crossing ? adapted.map(withEmptyScreens) : adapted;
  const theme = state.customThemesByDevice?.[from];
  return {
    ...state,
    slidesByDevice: { ...state.slidesByDevice, [device]: slides },
    ...(theme
      ? { customThemesByDevice: { ...state.customThemesByDevice, [device]: { ...theme, id: `ai-custom-${device}` } } }
      : {}),
  };
}

/** Copy the counterpart device's design (slides and AI palette) onto `device`. */
export function withCounterpartDesign(state: ProjectState, device: Device): ProjectState {
  const from = counterpartDevice(device, state.orientation);
  return from ? withDesignFrom(state, device, from) : state;
}

/**
 * Switching devices: an untouched deck adopts a designed deck's look, so an
 * iPhone deck shows up on Android ready to export and on iPad with the same
 * style and empty screens to fill. Edited decks are kept.
 */
export function switchDevice(state: ProjectState, device: Device): ProjectState {
  const next = { ...state, device };
  if (!isStarterDeck(device, state.slidesByDevice[device])) return next;
  const from = designSource(state, device);
  return from ? withDesignFrom(next, device, from) : next;
}
