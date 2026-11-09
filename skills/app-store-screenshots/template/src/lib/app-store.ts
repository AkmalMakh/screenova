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
  /** The current listing text: the source of truth for features and numbers. */
  description: string;
  screenshotUrls: string[];
  ipadScreenshotUrls: string[];
};

// Long enough for an app's feature list; the deck prompt reads the start.
const MAX_DESCRIPTION = 4_000;

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
    description: str(result.description).trim().slice(0, MAX_DESCRIPTION),
    screenshotUrls,
    ipadScreenshotUrls,
  };
}

// The lookup API lists screenshots as small thumbnails (".../320x480bb.jpg",
// about 240x520). Apple's CDN serves any bounding box up to the original, so
// ask for the full size: sharp inside exported frames and readable for the AI.
// JPEG keeps a full iPhone capture near 300 KB (the PNG is over 1.5 MB).
export function fullSizeScreenshotUrl(url: string, box = 4000): string {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith(".mzstatic.com")) return url;
    parsed.pathname = parsed.pathname.replace(/\/\d+x\d+[a-z]*\.(?:jpe?g|png|webp)$/i, `/${box}x${box}bb.jpg`);
    return parsed.toString();
  } catch {
    return url;
  }
}

// The deck route reads at most this much of each message.
const BRIEF_LIMIT = 1_500;

/** An imported app's design brief: what it is, then its live listing text. */
export function listingBrief(app: Pick<AppStoreLookupResult, "trackName" | "primaryGenreName" | "description">): string {
  const intro = `Design App Store screenshots for "${app.trackName}"${app.primaryGenreName ? `, a ${app.primaryGenreName} app` : ""}, using its current screenshots.`;
  // Older lookups and some listings come back without a description.
  const description = (app.description ?? "").replace(/\s+\n/g, "\n").trim();
  if (!description) return intro;
  const heading = "\n\nIts current App Store description, the source of truth for features and numbers:\n";
  return intro + heading + description.slice(0, Math.max(0, BRIEF_LIMIT - intro.length - heading.length));
}
