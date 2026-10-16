import sharp from "sharp";
import type { Access } from "./access";
import { readAsset } from "./assets";

export const IMAGE_DATA_URL = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
export const MAX_IMAGE_DATA_URL_LENGTH = 11_200_000;
export function isDesignImageSource(value: unknown): value is string {
  return typeof value === "string" && value.length <= MAX_IMAGE_DATA_URL_LENGTH &&
    (IMAGE_DATA_URL.test(value) || /^\/api\/assets\/[a-zA-Z0-9/_.-]+$/.test(value));
}

// Cloud requests carry owner-scoped asset paths, never public or expiring URLs.
// Resolve only after authentication and request validation; no arbitrary fetches.
export async function resolveDesignImage(access: Access, source: string): Promise<string> {
  if (IMAGE_DATA_URL.test(source) && source.length <= MAX_IMAGE_DATA_URL_LENGTH) return source;
  if (!access.client || !source.startsWith(`/api/assets/${access.userId}/`) || source.includes("/_uploads/")) {
    throw new Error("Invalid design image");
  }
  const bytes = await readAsset(access, source);
  if (bytes.length > 8 * 1024 * 1024) throw new Error("Image too large");
  const metadata = await sharp(bytes, { limitInputPixels: 64_000_000 }).metadata();
  if (!metadata.width || !metadata.height || !["png", "jpeg", "webp"].includes(metadata.format || "")) {
    throw new Error("Invalid design image");
  }
  return `data:image/${metadata.format};base64,${bytes.toString("base64")}`;
}
