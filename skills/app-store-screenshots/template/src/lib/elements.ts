import type {
  BuiltInElementId,
  DecorationElementId,
  ElementId,
  TextElementId,
} from "./types";

export const BUILT_IN_ELEMENT_IDS: BuiltInElementId[] = [
  "caption",
  "device",
  "deviceSecondary",
];

export const TEXT_ELEMENT_PREFIX = "text:";
export const DECORATION_ELEMENT_PREFIX = "decoration:";

export function isBuiltInElementId(id: ElementId | string): id is BuiltInElementId {
  return (BUILT_IN_ELEMENT_IDS as string[]).includes(id);
}

export function isTextElementId(id: ElementId | string | null | undefined): id is TextElementId {
  return typeof id === "string" && id.startsWith(TEXT_ELEMENT_PREFIX);
}

export function toTextElementId(id: string): TextElementId {
  return `${TEXT_ELEMENT_PREFIX}${id}` as TextElementId;
}

export function textElementKey(id: TextElementId | ElementId): string {
  return isTextElementId(id) ? id.slice(TEXT_ELEMENT_PREFIX.length) : id;
}

export function isDecorationElementId(
  id: ElementId | string | null | undefined,
): id is DecorationElementId {
  return typeof id === "string" && id.startsWith(DECORATION_ELEMENT_PREFIX);
}

export function toDecorationElementId(id: string): DecorationElementId {
  return `${DECORATION_ELEMENT_PREFIX}${id}` as DecorationElementId;
}

export function decorationElementKey(id: DecorationElementId | ElementId): string {
  return isDecorationElementId(id) ? id.slice(DECORATION_ELEMENT_PREFIX.length) : id;
}
