import { describe, expect, it } from "vitest";
import { localizedUpload } from "./localized-upload";

describe("copy-on-write localized screenshots", () => {
  it("gives a duplicated project's replacement a new path and preserves each other locale", () => {
    const old = "/api/assets/alice/localized/{locale}/original.png";
    const first = localizedUpload(old, "en", ["en", "de", "fr"], "same-slide");
    const second = localizedUpload(old, "en", ["en", "de", "fr"], "same-slide");
    expect(first.pattern).not.toBe(second.pattern);
    expect(first.pattern).not.toBe(old);
    expect(first.options.seedSources).toEqual([
      { sourcePath: "/api/assets/alice/localized/de/original.png", targetPath: first.pattern!.replace("{locale}", "de") },
      { sourcePath: "/api/assets/alice/localized/fr/original.png", targetPath: first.pattern!.replace("{locale}", "fr") },
    ]);
    expect(first.options.targetPath).toBe(first.pattern!.replace("{locale}", "en"));
  });
  it("also versions automatic localization for copies retaining the same slide ID", () => {
    const first = localizedUpload("/screenshots/uploaded/original.jpg", "de", ["en", "de"], "same-slide");
    const second = localizedUpload("/screenshots/uploaded/original.jpg", "de", ["en", "de"], "same-slide");
    expect(first.pattern).not.toBe(second.pattern);
    expect(first.options.seedSources?.[0].sourcePath).toBe("/screenshots/uploaded/original.jpg");
  });
  it("keeps nonlocalized uploads unchanged and handles one-locale patterns", () => {
    expect(localizedUpload("", "en", ["en"], "slide")).toEqual({ options: {} });
    expect(localizedUpload("data:image/png;base64,YQ==", "en", ["en", "de"], "slide")).toEqual({ options: {} });
    expect(localizedUpload("/screenshots/localized/{locale}/old.png", "en", ["en"]).options.seedSources).toEqual([]);
  });
});
