import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import sharp from "sharp";
import { POST } from "./route";

const url = "https://apps.apple.com/us/app/calendar/id123456789";
const imageUrl = "https://is1-ssl.mzstatic.com/image/shot.png";
const iconUrl = "https://is1-ssl.mzstatic.com/image/icon.png";
let png: Buffer;
const lookup = (screenshots = [imageUrl]) => Response.json({ results: [{
  trackName: "Calendar", screenshotUrls: screenshots, artworkUrl512: iconUrl,
}] });
const request = () => new Request("http://localhost/api/app-store/import", {
  method: "POST", body: JSON.stringify({ url, device: "iphone" }),
});
beforeEach(async () => {
  png = await sharp({ create: { width: 10, height: 20, channels: 3, background: "#ABCDEF" } }).png().toBuffer();
  vi.spyOn(fs, "mkdir").mockResolvedValue(undefined);
  vi.spyOn(fs, "writeFile").mockResolvedValue(undefined);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("App Store image import", () => {
  it("keeps valid screenshots when the icon times out", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      if (input.includes("itunes.apple.com")) return lookup();
      if (input === iconUrl) throw new Error("timeout");
      return new Response(new Uint8Array(png), { headers: { "content-type": "image/png; charset=binary" } });
    }));
    const response = await POST(request());
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.iconPath).toBe("");
    expect(result.screenshots).toHaveLength(1);
  });
  it("reports a download failure as JSON rather than throwing", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      if (input.includes("itunes.apple.com")) return lookup();
      throw new Error("download failed");
    }));
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect((await response.json()).ok).toBe(false);
  });
  it("rejects non-image content and untrusted download hosts", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      if (input.includes("itunes.apple.com")) return lookup([imageUrl, "https://untrusted.example/shot.png"]);
      return new Response("not an image", { headers: { "content-type": "image/png" } });
    }));
    expect((await POST(request())).status).toBe(502);
    expect(fs.writeFile).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalledWith("https://untrusted.example/shot.png", expect.anything());
  });
});
