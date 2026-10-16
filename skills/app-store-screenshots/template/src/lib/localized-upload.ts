import { resolveScreenshot } from "./locale";
import type { UploadOptions } from "./upload-client";

export function localizedUpload(value: string, locale: string | undefined, locales: string[], slug?: string):
  { pattern?: string; options: UploadOptions } {
  if (!locale || !(value.includes("{locale}") || (locales.length > 1 && slug && value && !value.startsWith("data:")))) {
    return { options: {} };
  }
  // Paths are immutable versions: project copies and Undo may retain the old one.
  const pattern = `/screenshots/localized/{locale}/manual-${crypto.randomUUID()}.png`;
  return {
    pattern,
    options: {
      targetPath: resolveScreenshot(pattern, locale),
      seedSources: [...new Set(locales)].filter(loc => loc !== locale).map(loc => ({
        sourcePath: resolveScreenshot(value, loc),
        targetPath: resolveScreenshot(pattern, loc),
      })),
    },
  };
}
