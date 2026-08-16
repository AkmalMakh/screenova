// Helpers for the App Store link flow (server-safe; no window access).
// Links are parsed into { country, appId } and resolved through Apple's
// public iTunes Lookup API, which is fetched server-side only.

export type AppStoreLink = {
  country: string;
  appId: string;
};

export type AppStoreLookupResult = {
  appId: string;
  country: string;
  trackName: string;
  sellerName: string;
  primaryGenreName: string;
  averageUserRating: number;
  userRatingCount: number;
  version: string;
  trackViewUrl: string;
  artworkUrl100: string;
  artworkUrl512: string;
  screenshotUrls: string[];
  ipadScreenshotUrls: string[];
};

const HOST_SUFFIXES = ["apps.apple.com", "itunes.apple.com"];
const APP_ID = /^\d{4,20}$/;

function countryFromSegments(segments: string[]): string {
  const first = segments[0] || "";
  return /^[a-z]{2}$/i.test(first) ? first.toLowerCase() : "us";
}

/**
 * Extract { country, appId } from an App Store URL. Accepts links shaped like
 * - https://apps.apple.com/us/app/slug/id123456789
 * - https://apps.apple.com/app/id123456789?l=en-GB
 * - https://itunes.apple.com/us/app/slug/id123456789?mt=8
 * Returns null for anything else (bad host, no numeric id, non-URL).
 */
export function parseAppStoreUrl(raw: string): AppStoreLink | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (!HOST_SUFFIXES.includes(host)) return null;
  const segments = url.pathname.split("/").filter(Boolean);
  const idSegment = segments.find((segment) => /^id\d+$/i.test(segment));
  const appId = idSegment ? idSegment.slice(2) : url.searchParams.get("id") || "";
  if (!APP_ID.test(appId)) return null;
  return { country: countryFromSegments(segments), appId };
}

/**
 * Normalize the raw iTunes Lookup response into a flat, bounded result.
 * Returns null when the response holds no usable app (no name, no screenshots).
 */
export function normalizeLookupResult(
  raw: unknown,
  link: AppStoreLink,
): AppStoreLookupResult | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as { results?: unknown };
  const result = (Array.isArray(body.results) ? body.results[0] : null) as
    | Record<string, unknown>
    | null;
  if (!result || typeof result !== "object") return null;

  const str = (value: unknown) => (typeof value === "string" ? value : "");
  const num = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value : 0;
  const list = (value: unknown) =>
    Array.isArray(value)
      ? value.filter(
          (entry): entry is string => typeof entry === "string" && /^https:\/\//.test(entry),
        )
      : [];

  const trackName = str(result.trackName).trim();
  if (!trackName) return null;
  const screenshotUrls = list(result.screenshotUrls);
  const ipadScreenshotUrls = list(result.ipadScreenshotUrls);
  if (!screenshotUrls.length && !ipadScreenshotUrls.length) return null;

  return {
    appId: link.appId,
    country: link.country,
    trackName,
    sellerName: str(result.sellerName) || str(result.artistName),
    primaryGenreName: str(result.primaryGenreName),
    averageUserRating: num(result.averageUserRating),
    userRatingCount: num(result.userRatingCount),
    version: str(result.version),
    trackViewUrl: str(result.trackViewUrl),
    artworkUrl100: str(result.artworkUrl100),
    artworkUrl512: str(result.artworkUrl512) || str(result.artworkUrl100),
    screenshotUrls,
    ipadScreenshotUrls,
  };
}
