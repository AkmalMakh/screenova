import type { ProjectState } from "./types";

/**
 * Screenshot paths a draft may read: local uploads and App Store imports, or
 * a private cloud asset. Never anything else, so a draft can't be pointed at
 * an arbitrary file or URL.
 */
export const DRAFT_SCREENSHOT_PATH =
  /^\/(?:screenshots\/(?:uploaded\/[\w.-]+|app-store\/[\w.-]+\/[\w.-]+)|api\/assets\/[a-f0-9-]+\/[\w/.-]+)\.(png|jpe?g|webp)$/i;

/**
 * Screenshots the user has already uploaded, newest project first, for the
 * "Your uploads" picker. Drawn from their own projects, so app icons and AI
 * backgrounds stay out and every entry is a real app screen.
 */
export function libraryScreenshots(projects: Record<string, ProjectState>, owner: string | null): string[] {
  const ordered = Object.values(projects).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  const seen = new Set<string>();
  const paths: string[] = [];
  for (const project of ordered) {
    for (const slides of Object.values(project.slidesByDevice ?? {})) {
      for (const slide of slides ?? []) {
        const candidates = [
          slide.screenshot,
          slide.screenshotSecondary,
          ...Object.values(slide.screenshotByLocale ?? {}),
          ...Object.values(slide.screenshotSecondaryByLocale ?? {}),
        ];
        for (const path of candidates) {
          if (typeof path !== "string" || seen.has(path) || !isOwnScreenshot(path, owner)) continue;
          seen.add(path);
          paths.push(path);
        }
      }
    }
  }
  return paths;
}

function isOwnScreenshot(path: string, owner: string | null): boolean {
  if (!DRAFT_SCREENSHOT_PATH.test(path) || path.includes("/_uploads/")) return false;
  // Signed in, only this account's private assets; in local mode, only files on disk.
  return owner ? path.startsWith(`/api/assets/${owner}/`) : !path.startsWith("/api/assets/");
}

/** A small preview: cloud assets are resized on the server, local files load as they are. */
export function thumbnailUrl(path: string, width = 240): string {
  return path.startsWith("/api/assets/") ? `${path}?w=${width}` : path;
}
