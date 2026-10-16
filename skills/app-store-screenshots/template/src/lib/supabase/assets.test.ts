import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { randomBytes } from "node:crypto";
import { POST } from "@/app/api/upload/route";
import { GET } from "@/app/api/assets/[...asset]/route";
import { localizedUpload } from "../localized-upload";

const authorize = vi.hoisted(() => vi.fn());
vi.mock("./access", () => ({ authorizeRequest: authorize, privateHeaders: { "cache-control": "private, no-store", vary: "Cookie" } }));
const owner = "11111111-1111-4111-8111-111111111111";
const objects = new Map<string, { bytes: Buffer; mime: string }>();
const download = vi.fn(async (key: string) => ({ data: objects.has(key) ? new Blob([new Uint8Array(objects.get(key)!.bytes)]) : null, error: null }));
const upload = vi.fn(async (key: string, bytes: Buffer, options: { contentType: string }) => {
  objects.set(key, { bytes, mime: options.contentType }); return { error: null };
});
const remove = vi.fn(async (keys: string[]) => { keys.forEach(key => objects.delete(key)); return { error: null }; });
const from = vi.fn(() => ({ upload, download, remove }));
const get = (url: string) => GET(new Request(`https://studio.example${url}`), { params: Promise.resolve({ asset: url.slice("/api/assets/".length).split("/") }) });
const post = (body: unknown) => POST(new Request("https://studio.example/api/upload", { method: "POST", body: JSON.stringify(body) }));
beforeEach(() => {
  vi.clearAllMocks(); objects.clear();
  authorize.mockResolvedValue({ userId: owner, client: { storage: { from } } });
});
const pixels = (background = "#0055ee") => sharp({ create: { width: 8, height: 12, channels: 3, background } }).png().toBuffer();

describe("private asset route integration with a storage adapter", () => {
  it("copies each locale on replacement without changing the original project's image bytes", async () => {
    const oldPattern = `/api/assets/${owner}/localized/{locale}/original.png`;
    const en = await pixels("#00ff00");
    const de = await pixels("#0000ff");
    objects.set(`${owner}/localized/en/original.png`, { bytes: en, mime: "image/png" });
    objects.set(`${owner}/localized/de/original.png`, { bytes: de, mime: "image/png" });
    const copy = localizedUpload(oldPattern, "en", ["en", "de"], "shared-slide");
    const replacement = await pixels("#ff0000");
    const response = await post({ dataUrl: `data:image/png;base64,${replacement.toString("base64")}`, ...copy.options });
    expect(response.status).toBe(200);
    const { path } = await response.json();
    expect(path).not.toBe(oldPattern.replace("{locale}", "en"));
    expect(Buffer.from(await (await get(path)).arrayBuffer())).toEqual(replacement);
    expect(Buffer.from(await (await get(path.replace("/en/", "/de/"))).arrayBuffer())).toEqual(de);
    expect(objects.get(`${owner}/localized/en/original.png`)?.bytes).toEqual(en);
    expect(objects.get(`${owner}/localized/de/original.png`)?.bytes).toEqual(de);
    // Undo still references the old immutable image, whose bytes remain intact.
    expect(Buffer.from(await (await get(oldPattern.replace("{locale}", "en"))).arrayBuffer())).toEqual(en);
  });
  it("rejects invalid or unavailable locale sources without replacing the active image", async () => {
    const bytes = await pixels();
    const payload = { dataUrl: `data:image/png;base64,${bytes.toString("base64")}`, targetPath: "/screenshots/localized/en/new.png" };
    expect((await post({ ...payload, seedSources: null })).status).toBe(400);
    expect((await post({ ...payload, seedSources: [{ sourcePath: "/api/assets/other/private.png", targetPath: "/screenshots/localized/de/new.png" }] })).status).toBe(503);
    expect((await post({ ...payload, seedSources: [{ sourcePath: `/api/assets/${owner}/missing.png`, targetPath: "/screenshots/localized/de/new.png" }] })).status).toBe(503);
    expect(upload).not.toHaveBeenCalled();
  });
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
    expect(Buffer.from(await image.arrayBuffer()).equals(bytes)).toBe(true);
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
  it("finalizes and streams a valid image larger than Vercel's 4.5 MB body limit", async () => {
    const bytes = await sharp(randomBytes(2400 * 800 * 3), { raw: { width: 2400, height: 800, channels: 3 } }).png().toBuffer();
    expect(bytes.length).toBeGreaterThan(4_500_000);
    const key = `${owner}/_uploads/22222222-2222-4222-8222-222222222222.png`;
    objects.set(key, { bytes, mime: "image/png" });
    const body = { sourcePath: `/api/assets/${key}` };
    expect(JSON.stringify(body).length).toBeLessThan(200);
    const response = await post(body);
    expect(response.status).toBe(200);
    const { path } = await response.json();
    expect(objects.has(key)).toBe(false);
    expect(authorize).toHaveBeenCalledWith(expect.any(Request), "upload");
    const image = await get(path);
    expect(image.body).toBeInstanceOf(ReadableStream);
    expect(image.headers.has("content-length")).toBe(false);
    expect(Buffer.from(await image.arrayBuffer()).equals(bytes)).toBe(true);
  });
  it("rejects foreign, traversal, permanent and mixed sources without reading or deleting them", async () => {
    for (const sourcePath of ["/api/assets/other/_uploads/22222222-2222-4222-8222-222222222222.png", `/api/assets/${owner}/_uploads/../private.png`, `/api/assets/${owner}/private.png`]) {
      expect((await post({ sourcePath })).status).toBe(400);
    }
    expect((await post({ sourcePath: `/api/assets/${owner}/_uploads/22222222-2222-4222-8222-222222222222.png`, dataUrl: "data:image/png;base64,YQ==" })).status).toBe(400);
    expect(download).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
  it("removes invalid and oversized staged files and never serves staging objects", async () => {
    const key = `${owner}/_uploads/22222222-2222-4222-8222-222222222222.png`;
    objects.set(key, { bytes: Buffer.from("not an image"), mime: "image/png" });
    expect((await get(`/api/assets/${key}`)).status).toBe(404);
    expect((await post({ sourcePath: `/api/assets/${key}` })).status).toBe(400);
    expect(objects.has(key)).toBe(false);
    objects.set(key, { bytes: Buffer.alloc(8 * 1024 * 1024 + 1), mime: "image/png" });
    expect((await post({ sourcePath: `/api/assets/${key}` })).status).toBe(413);
    expect(objects.has(key)).toBe(false);
    expect(upload).not.toHaveBeenCalled();
  });
  it("requires cloud authorization for source paths and handles null JSON", async () => {
    authorize.mockResolvedValue({ userId: null, client: null });
    expect((await post({ sourcePath: `/api/assets/${owner}/_uploads/22222222-2222-4222-8222-222222222222.png` })).status).toBe(400);
    expect((await post(null)).status).toBe(400);
    expect(from).not.toHaveBeenCalled();
    authorize.mockResolvedValue({ response: new Response("Unauthorized", { status: 401 }) });
    expect((await post({ sourcePath: "anything" })).status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });
});
