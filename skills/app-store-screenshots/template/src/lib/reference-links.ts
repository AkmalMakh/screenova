/** Normalize reference links without fetching arbitrary sites. */
export function normalizeReferenceUrl(raw: string): string | null {
  try {
    const value = raw.trim();
    if (!value || /\s/.test(value)) return null;
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    if (!url.hostname.includes(".") || url.hostname.endsWith(".")) return null;
    // Reference requests accept HTTPS. Normalize common HTTP-pasted links too.
    url.protocol = "https:";
    return url.toString();
  } catch {
    return null;
  }
}

function trimProsePunctuation(value: string): string {
  let next = value.replace(/[.,;!?:]+$/, "");
  for (const [open, close] of [["(", ")"], ["[", "]"], ["{", "}"]]) {
    while (next.endsWith(close) && next.split(close).length > next.split(open).length) {
      next = next.slice(0, -1).replace(/[.,;!?:]+$/, "");
    }
  }
  return next;
}

/**
 * Extract links embedded in prose, including bare App Store links. While
 * typing, wait for a token boundary; paste, blur and submit finish the token.
 * Keep the original description untouched and deduplicate normalized URLs.
 */
export function extractReferenceLinks(text: string, complete = true): string[] {
  const urls = new Set<string>();
  const pattern = /(?<![\w@])(?:https?:\/\/|www\.|(?:apps|itunes)\.apple\.com\/)[^\s<>"']+/gi;
  for (const match of text.matchAll(pattern)) {
    const token = trimProsePunctuation(match[0]);
    const end = match.index! + match[0].length;
    if (!complete && end === text.length && token === match[0]) continue;
    const url = normalizeReferenceUrl(token);
    if (url) urls.add(url);
  }
  return [...urls];
}
