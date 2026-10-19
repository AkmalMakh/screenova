import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { DELETE, GET, PATCH } from "./[id]/route";
import { GET as preview } from "@/app/gallery/[id]/preview/[n]/route";
import { listGalleryPosts } from "@/lib/gallery-store";
import { toGalleryTemplate } from "@/lib/gallery";
import { mergeWithDefaults } from "@/lib/storage";

// Local mode end to end through the real route handlers and file store. The
// hosted policies are covered by policies.test.ts on real Postgres.
let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "gallery-"));
  vi.stubEnv("APP_STORAGE_MODE", "local");
  vi.stubEnv("APP_GALLERY_FILE", path.join(dir, "gallery.json"));
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==";
const template = () => toGalleryTemplate(mergeWithDefaults({ appName: "Mote", device: "iphone" }));
const request = (method: string, body?: unknown) => new Request("http://127.0.0.1/api/gallery", {
  method,
  headers: { "content-type": "application/json", origin: "http://127.0.0.1" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe("gallery routes (local mode)", () => {
  it("publishes, lists, serves previews and the template, then unpublishes", async () => {
    // Value: protects=the whole publish → browse → reuse → unpublish loop; fails_when=any step loses the post or serves data it should not
    const created = await POST(request("POST", { title: "Calm deck", description: "Soft pinks", template: template(), previews: [JPEG] }));
    expect(created.status).toBe(201);
    const { id } = await created.json();
    expect((await listGalleryPosts()).map((post) => post.title)).toEqual(["Calm deck"]);

    const image = await preview(new Request("http://127.0.0.1"), { params: Promise.resolve({ id, n: "0" }) });
    expect(image.headers.get("content-type")).toBe("image/jpeg");
    expect((await preview(new Request("http://127.0.0.1"), { params: Promise.resolve({ id, n: "3" }) })).status).toBe(404);

    const read = await GET(request("GET"), params(id));
    expect(await read.json()).toMatchObject({ ok: true, title: "Calm deck", template: { device: "iphone" } });

    expect((await DELETE(request("DELETE"), params(id))).status).toBe(200);
    expect(await listGalleryPosts()).toEqual([]);
    expect((await GET(request("GET"), params(id))).status).toBe(404);
  });

  it("rejects malformed posts before storing anything", async () => {
    expect((await POST(request("POST", { title: "", template: template(), previews: [JPEG] }))).status).toBe(400);
    expect((await POST(request("POST", { title: "x", template: template(), previews: ["https://example.com/a.jpg"] }))).status).toBe(400);
    expect((await POST(request("POST", { title: "x", template: { version: 2 }, previews: [JPEG] }))).status).toBe(400);
    expect((await POST(new Request("http://127.0.0.1/api/gallery", { method: "POST", body: "{" }))).status).toBe(400);
    expect(await listGalleryPosts()).toEqual([]);
  });

  it("hides a post from the public list and preview route", async () => {
    const { id } = await (await POST(request("POST", { title: "Hide me", template: template(), previews: [JPEG] }))).json();
    expect((await PATCH(request("PATCH", { hidden: false }), params(id))).status).toBe(400);
    expect((await PATCH(request("PATCH", { hidden: true }), params(id))).status).toBe(200);
    expect(await listGalleryPosts()).toEqual([]);
    expect((await preview(new Request("http://127.0.0.1"), { params: Promise.resolve({ id, n: "0" }) })).status).toBe(404);
  });
});
