export type Device =
  | "iphone"
  | "ipad"
  | "android"
  | "android-7"
  | "android-10"
  | "feature-graphic";

export type Orientation = "portrait" | "landscape";

export type Platform = "ios" | "android";

export type HeadlineFontFamily =
  | "modern"
  | "editorial"
  | "geometric"
  | "rounded"
  | "mono";

// Layouts the editor can render. Vary across slides for visual rhythm.
export type SlideLayout =
  | "hero"             // centered device, headline above
  | "device-bottom"    // headline top, device bottom-center
  | "device-top"       // device top, headline bottom (contrast)
  | "two-devices"      // back + front phones, headline above
  | "no-device"        // big headline + decorative blob, no device
  | "split-landscape"  // landscape tablets only: caption left + device right
  | "feature-graphic"; // 1024×500 banner with icon + name + tagline

// Per-element rect in canvas pixel space. Optional rotation in degrees and zIndex.
export type ElementTransform = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  zIndex?: number;
};

export type BuiltInElementId = "caption" | "device" | "deviceSecondary";
export type TextElementId = `text:${string}`;
export type DecorationElementId = `decoration:${string}`;
export type ElementId = BuiltInElementId | TextElementId | DecorationElementId;

export type SelectedElement = {
  slideId: string;
  elementId: ElementId;
};

// Per-locale text keyed by locale code (e.g. "en", "de"). A locale is absent
// if the user hasn't typed anything for it; renderers fall back to en (see
// lib/locale.ts). The set of locales a project targets lives on
// ProjectState.locales.
export type LocalizedText = Partial<Record<string, string>>;

export type TextElement = {
  id: string;
  text: LocalizedText;
  transform: ElementTransform;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  align?: "left" | "center" | "right";
};

export type DecorationElement = {
  id: string;
  // "icon-tile" draws a rounded tile filled with `fill` and a centered glyph
  // from lib/decoration-icons.ts; every other kind is a plain filled shape.
  kind: "ellipse" | "rounded-rectangle" | "line" | "icon-tile";
  transform: ElementTransform;
  fill: {
    type: "solid" | "linear-gradient";
    colors: string[];
    angle?: number;
  };
  opacity: number;
  borderRadius?: number;
  blur?: number;
  // icon-tile only: allowlisted icon key, and the glyph color drawn on the tile.
  iconName?: string;
  iconColor?: string;
};

export type VisualAsset = {
  src: string;
  prompt: string;
  opacity: number;
};

export type Slide = {
  id: string;
  layout: SlideLayout;
  label: LocalizedText;       // tiny uppercase caption above headline, per locale
  headline: LocalizedText;    // multi-line; newlines are intentional, per locale
  headlineFontFamily?: HeadlineFontFamily;
  screenshot: string;         // path under /screenshots/ — may contain {locale}
  screenshotSecondary?: string; // for two-devices layout — may contain {locale}
  screenshotByLocale?: Partial<Record<string, string>>;
  screenshotSecondaryByLocale?: Partial<Record<string, string>>;
  inverted?: boolean;         // dark background variant
  // Per-element overrides; when present, replaces layout default placement.
  transforms?: Partial<Record<BuiltInElementId, ElementTransform>>;
  textElements?: TextElement[];
  decorations?: DecorationElement[];
  visualAsset?: VisualAsset;
  // Workspace-only position of the screen on the editor canvas (canvas px,
  // relative to the screen's slot in the strip). Never affects export.
  canvasOffset?: { x: number; y: number };
};

export type ThemeId =
  | "clean-light"
  | "dark-bold"
  | "warm-editorial"
  | "ocean-fresh"
  | "bloom-roast"
  | "mote-calendar";

export type Theme = {
  id: string;
  name: string;
  bg: string;          // primary background
  bgAlt: string;       // inverted background
  fg: string;          // text on bg
  fgAlt: string;       // text on bgAlt
  accent: string;
  muted: string;
};

export type ProjectState = {
  // Project identity. Optional so legacy single-project states stay valid;
  // assigned on load/creation by the project store.
  id?: string;        // stable project key used for per-project storage
  name?: string;      // label shown in the project switcher (appName is the product name)
  updatedAt?: number; // epoch ms of the last edit
  schemaVersion?: number;
  appName: string;
  themeId: string;
  customTheme?: Theme;
  customThemesByDevice?: Partial<Record<Device, Theme>>;
  // v1 projects render as isolated screens until the user opts into connected crops.
  connectedCanvas: boolean;
  // Locales this project targets. Drives the toolbar dropdown and bulk export.
  // Single-locale projects ship as ["en"] and hide the locale UI.
  locales: string[];
  locale: string;
  device: Device;
  orientation: Orientation;
  // Per-device slide decks so platform switching preserves work
  slidesByDevice: Record<Device, Slide[]>;
  appIcon?: string;    // path under /public (e.g. /app-icon.png)
};

// Lightweight project summary for list UIs (switcher, manage dialog).
export type ProjectMeta = {
  id: string;
  name: string;
  updatedAt: number;
};
