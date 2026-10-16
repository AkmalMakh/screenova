import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { POST } from "@/app/api/upload/route";
import { GET } from "@/app/api/assets/[...asset]/route";

const authorize = vi.hoisted(() => vi.fn());
vi.mock("./access", () => ({ authorizeRequest: authorize, privateHeaders: { "cache-control": "private, no-store", vary: "Cookie" } }));
const owner = "11111111-1111-4111-8111-111111111111";
const objects = new Map<string, { bytes: Buffer; mime: string }>();
const download = vi.fn(async (key: string) => ({ data: objects.has(key) ? new Blob([new Uint8Array(objects.get(key)!.bytes)]) : null, error: null }));
const upload = vi.fn(async (key: string, bytes: Buffer, options: { contentType: string }) => {
  objects.set(key, { bytes, mime: options.contentType }); return { error: null };
});
const from = vi.fn(() => ({ upload, download }));
const get = (url: string) => GET(new Request(`https://studio.example${url}`), { params: Promise.resolve({ asset: url.slice("/api/assets/".length).split("/") }) });
const post = (body: unknown) => POST(new Request("https://studio.example/api/upload", { method: "POST", body: JSON.stringify(body) }));
beforeEach(() => {
  vi.clearAllMocks(); objects.clear();
  authorize.mockResolvedValue({ userId: owner, client: { storage: { from } } });
});
const pixels = (background = "#0055ee") => sharp({ create: { width: 8, height: 12, channels: 3, background } }).png().toBuffer();

describe("private asset route integration with a storage adapter", () => {
  it("uploads under the owner and serves exactly the private image bytes", async () => {
    const bytes = await pixels();
    const response = await post({ dataUrl: `data:image/png;base64,${bytes.toString("base64")}` });
    expect(response.status).toBe(200);
    const { path } = await response.json();
    expect(path).toMatch(new RegExp(`^/api/assets/${owner}/[a-f0-9]+\\.png$`));
    expect(from).toHaveBeenCalledWith("project-assets");
    const image = await get(path);
    expect(image.headers.get("cache-control")).toBe("private, no-store");
    expect(image.headers.get("content-type")).toBe("image/png");
    expect(Buffer.from(await image.arrayBuffer())).toEqual(bytes);
  });
  it("seeds untouched locales while re-encoding a replacement to its PNG destination", async () => {
    const original = await pixels();
    objects.set(`${owner}/source.png`, { bytes: original, mime: "image/png" });
    const jpeg = await sharp(await pixels("#ee0000")).jpeg().toBuffer();
    const en = `/api/assets/${owner}/localized/en/phone.png`;
    const de = `/api/assets/${owner}/localized/de/phone.png`;
    const response = await post({ dataUrl: `data:image/jpeg;base64,${jpeg.toString("base64")}`, targetPath: en, seedFromPath: `/api/assets/${owner}/source.png`, seedPaths: [en, de] });
    expect(await response.json()).toEqual({ ok: true, path: en });
    const result = Buffer.from(await (await get(en)).arrayBuffer());
    expect((await sharp(result).metadata()).format).toBe("png");
    expect(Buffer.from(await (await get(de)).arrayBuffer())).toEqual(original);
    expect(objects.get(`${owner}/localized/en/phone.png`)?.mime).toBe("image/png");
  });
  it("blocks foreign owners and traversal before accessing the storage adapter", async () => {
    expect((await get("/api/assets/someone-else/private.png")).status).toBe(404);
    expect((await get(`/api/assets/${owner}/../private.png`)).status).toBe(404);
    const bytes = await pixels();
    expect((await post({ dataUrl: `data:image/png;base64,${bytes.toString("base64")}`, targetPath: "/api/assets/someone-else/localized/en/phone.png" })).status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });
});
