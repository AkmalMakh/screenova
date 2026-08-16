import { describe, expect, it } from "vitest";
import { normalizeLookupResult, parseAppStoreUrl } from "./app-store";

describe("parseAppStoreUrl", () => {
  it("parses a standard apps.apple.com link with country and slug", () => {
    expect(
      parseAppStoreUrl("https://apps.apple.com/us/app/carrot-weather/id961390574"),
    ).toEqual({ country: "us", appId: "961390574" });
  });

  it("parses a link without a country segment", () => {
    expect(parseAppStoreUrl("https://apps.apple.com/app/id961390574?mt=8")).toEqual({
      country: "us",
      appId: "961390574",
    });
  });

  it("parses an itunes.apple.com link", () => {
    expect(
      parseAppStoreUrl("https://itunes.apple.com/de/app/streaks/id963034692?mt=8"),
    ).toEqual({ country: "de", appId: "963034692" });
  });

  it("parses a link where the id comes from the query string", () => {
    expect(parseAppStoreUrl("https://apps.apple.com/us/app/any-slug?id=1234567890")).toEqual({
      country: "us",
      appId: "1234567890",
    });
  });

  it("trims surrounding whitespace and ignores a www prefix", () => {
    expect(parseAppStoreUrl("  https://www.apps.apple.com/us/app/x/id961390574  ")).toEqual({
      country: "us",
      appId: "961390574",
    });
  });

  it("rejects non-App-Store hosts", () => {
    expect(parseAppStoreUrl("https://play.google.com/store/apps/details?id=com.spotify.music")).toBeNull();
    expect(parseAppStoreUrl("https://example.com/app/id123456789")).toBeNull();
  });

  it("rejects links without a numeric app id", () => {
    expect(parseAppStoreUrl("https://apps.apple.com/us/app/some-slug")).toBeNull();
    expect(parseAppStoreUrl("https://apps.apple.com/us/app/idabc123")).toBeNull();
    expect(parseAppStoreUrl("https://apps.apple.com/us/app/id12")).toBeNull();
  });

  it("rejects non-URLs and non-http(s) protocols", () => {
    expect(parseAppStoreUrl("not a link")).toBeNull();
    expect(parseAppStoreUrl("")).toBeNull();
    expect(parseAppStoreUrl("ftp://apps.apple.com/us/app/x/id961390574")).toBeNull();
  });
});

describe("normalizeLookupResult", () => {
  const link = { country: "us", appId: "961390574" };

  it("normalizes a full lookup response", () => {
    const app = normalizeLookupResult(
      {
        resultCount: 1,
        results: [
          {
            trackName: "Carrot Weather",
            sellerName: "Grailr LLC",
            primaryGenreName: "Weather",
            averageUserRating: 4.8,
            userRatingCount: 125000,
            version: "6.2.1",
            trackViewUrl: "https://apps.apple.com/us/app/carrot-weather/id961390574",
            artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/icon100.png",
            artworkUrl512: "https://is1-ssl.mzstatic.com/image/thumb/icon512.png",
            screenshotUrls: ["https://is1-ssl.mzstatic.com/image/thumb/shot1.jpg"],
            ipadScreenshotUrls: ["https://is1-ssl.mzstatic.com/image/thumb/pad1.jpg"],
          },
        ],
      },
      link,
    );
    expect(app).not.toBeNull();
    expect(app?.trackName).toBe("Carrot Weather");
    expect(app?.sellerName).toBe("Grailr LLC");
    expect(app?.averageUserRating).toBe(4.8);
    expect(app?.userRatingCount).toBe(125000);
    expect(app?.artworkUrl512).toBe("https://is1-ssl.mzstatic.com/image/thumb/icon512.png");
    expect(app?.screenshotUrls).toHaveLength(1);
    expect(app?.ipadScreenshotUrls).toHaveLength(1);
  });

  it("falls back from sellerName to artistName", () => {
    const app = normalizeLookupResult(
      {
        results: [
          {
            trackName: "App",
            artistName: "Acme Inc",
            screenshotUrls: ["https://is1-ssl.mzstatic.com/image/thumb/shot1.jpg"],
          },
        ],
      },
      link,
    );
    expect(app?.sellerName).toBe("Acme Inc");
  });

  it("strips non-https screenshot entries", () => {
    const app = normalizeLookupResult(
      {
        results: [
          {
            trackName: "App",
            screenshotUrls: [
              "https://is1-ssl.mzstatic.com/image/thumb/good.jpg",
              "javascript:alert(1)",
              42,
            ],
          },
        ],
      },
      link,
    );
    expect(app?.screenshotUrls).toEqual(["https://is1-ssl.mzstatic.com/image/thumb/good.jpg"]);
  });

  it("returns null when the response has no results", () => {
    expect(normalizeLookupResult({ resultCount: 0, results: [] }, link)).toBeNull();
    expect(normalizeLookupResult(null, link)).toBeNull();
    expect(normalizeLookupResult("garbage", link)).toBeNull();
  });

  it("returns null when the app has no name or no screenshots", () => {
    expect(
      normalizeLookupResult(
        { results: [{ trackName: " ", screenshotUrls: [] }] },
        link,
      ),
    ).toBeNull();
    expect(
      normalizeLookupResult({ results: [{ trackName: "App", screenshotUrls: [] }] }, link),
    ).toBeNull();
  });
});
