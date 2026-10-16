import { describe, expect, it } from "vitest";
import { extractReferenceLinks, normalizeReferenceUrl } from "./reference-links";

describe("description reference links", () => {
  it("finds an App Store URL embedded in a description", () => {
    expect(extractReferenceLinks("Design a calendar like https://apps.apple.com/us/app/calendar/id123456789, but warmer."))
      .toEqual(["https://apps.apple.com/us/app/calendar/id123456789"]);
  });
  it("recognizes bare Apple and www links and normalizes HTTP", () => {
    expect(extractReferenceLinks("Use apps.apple.com/us/app/id123456789 and www.example.com/design or http://inspiration.test/page"))
      .toEqual(["https://apps.apple.com/us/app/id123456789", "https://www.example.com/design", "https://inspiration.test/page"]);
  });
  it("deduplicates canonical URLs in prose", () => {
    expect(extractReferenceLinks("https://EXAMPLE.com and https://example.com/"))
      .toEqual(["https://example.com/"]);
  });
  it("strips prose/markdown delimiters but preserves balanced URL parentheses", () => {
    expect(extractReferenceLinks("[Style](https://example.com/design). (https://example.com/a_(b))."))
      .toEqual(["https://example.com/design", "https://example.com/a_(b)"]);
  });
  it("keeps query strings and fragments intact", () => {
    expect(extractReferenceLinks("https://apps.apple.com/app/id123456789?l=en&platform=iphone#screenshots"))
      .toEqual(["https://apps.apple.com/app/id123456789?l=en&platform=iphone#screenshots"]);
  });
  it("does not treat email addresses or ordinary text as links", () => {
    expect(extractReferenceLinks("Contact me@www.example.com or write a blue gradient."))
      .toEqual([]);
  });
  it("rejects malformed and credential-bearing links", () => {
    for (const url of ["https://", "https://example.", "javascript:alert(1)", "https://user:secret@example.com", "not a link"]) {
      expect(normalizeReferenceUrl(url)).toBeNull();
    }
  });
  it("waits for a boundary when typing a URL, but accepts the final token on paste or submit", () => {
    const text = "Make it like https://example.com/design";
    expect(extractReferenceLinks(text, false)).toEqual([]);
    expect(extractReferenceLinks(`${text} `, false)).toEqual(["https://example.com/design"]);
    expect(extractReferenceLinks(text, true)).toEqual(["https://example.com/design"]);
  });
});
