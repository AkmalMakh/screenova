// The icon vocabulary for "icon-tile" decorations, kept free of the lucide
// component imports. Schema modules (lib/design.ts, lib/suggest-deck.ts) and
// the API routes that import them only need the names — pulling the React
// icon components in alongside would drag them into the server bundle.
// lib/decoration-icons.ts maps these to components for the renderer, and a
// `satisfies` check there guarantees the two stay in sync.
export const DECORATION_ICON_NAMES = [
  "alarm-clock",
  "bar-chart",
  "bell",
  "bell-ring",
  "book-open",
  "bookmark",
  "calendar",
  "calendar-check",
  "camera",
  "check",
  "clock",
  "coffee",
  "credit-card",
  "droplet",
  "dumbbell",
  "filter",
  "flame",
  "folder",
  "gift",
  "globe",
  "headphones",
  "heart",
  "home",
  "image",
  "key",
  "layers",
  "leaf",
  "link",
  "lock",
  "mail",
  "map",
  "map-pin",
  "message",
  "mic",
  "moon",
  "music",
  "palette",
  "pencil",
  "phone",
  "pie-chart",
  "play",
  "repeat",
  "rocket",
  "search",
  "send",
  "settings",
  "share",
  "shield",
  "shopping-bag",
  "smile",
  "sparkles",
  "star",
  "sun",
  "tag",
  "target",
  "thumbs-up",
  "timer",
  "trending-up",
  "trophy",
  "user",
  "users",
  "video",
  "wallet",
  "wand",
  "watch",
  "zap",
] as const;

export type DecorationIconName = (typeof DECORATION_ICON_NAMES)[number];

export const DEFAULT_DECORATION_ICON: DecorationIconName = "sparkles";

export function isDecorationIconName(value: unknown): value is DecorationIconName {
  return (
    typeof value === "string" && (DECORATION_ICON_NAMES as readonly string[]).includes(value)
  );
}
