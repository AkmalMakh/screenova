import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setAccountScope } from "./account-scope";
import { uploadDataUrl } from "./upload-client";

const storage = vi.hoisted(() => ({ upload: vi.fn(), remove: vi.fn() }));
vi.mock("./supabase/browser", () => ({ browserSupabase: () => ({ storage: { from: () => storage } }) }));
const owner = "11111111-1111-4111-8111-111111111111";
const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  setAccountScope(owner);
  storage.upload.mockResolvedValue({ error: null });
  storage.remove.mockResolvedValue({ error: null });
  fetchMock.mockResolvedValue(Response.json({ ok: true, path: `/api/assets/${owner}/saved.png` }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { setAccountScope(null); vi.unstubAllGlobals(); });

describe("Vercel-safe image upload transport", () => {
  it("sends a 6 MB image to Storage and only owner-scoped metadata through Vercel", async () => {
    const bytes = Buffer.alloc(6 * 1024 * 1024, 42);
    const targetPath = `/api/assets/${owner}/localized/en/phone.png`;
    expect(await uploadDataUrl(`data:image/png;base64,${bytes.toString("base64")}`, { targetPath })).toBe(`/api/assets/${owner}/saved.png`);
    const [key, uploaded, options] = storage.upload.mock.calls[0];
    expect(key).toMatch(new RegExp(`^${owner}/_uploads/.*\\.png$`));
    expect(Buffer.from(uploaded).equals(bytes)).toBe(true);
    expect(options).toEqual({ contentType: "image/png", upsert: false });
    const [, request] = fetchMock.mock.calls[0];
    expect(request.body.length).toBeLessThan(400);
    expect(JSON.parse(request.body)).toEqual({ sourcePath: `/api/assets/${key}`, targetPath });
    expect(request.headers.get("x-screenova-owner")).toBe(owner);
    expect(storage.remove).toHaveBeenCalledWith([key]);
  });
  it("preserves local inline uploads without touching cloud storage", async () => {
    setAccountScope(null);
    await uploadDataUrl("data:image/png;base64,YQ==");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ dataUrl: "data:image/png;base64,YQ==" });
    expect(storage.upload).not.toHaveBeenCalled();
  });
  it("cleans staging on finalization failures and never falls back to inline cloud requests", async () => {
    fetchMock.mockResolvedValue(new Response("Daily limit", { status: 429 }));
    expect(await uploadDataUrl("data:image/png;base64,YQ==")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(storage.remove).toHaveBeenCalledTimes(1);
    storage.upload.mockResolvedValue({ error: new Error("Unauthorized") });
    expect(await uploadDataUrl("data:image/png;base64,YQ==")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("aborts finalization when the document account changes during upload", async () => {
    storage.upload.mockImplementationOnce(async () => { setAccountScope("another-owner"); return { error: null }; });
    expect(await uploadDataUrl("data:image/png;base64,YQ==")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(storage.remove).toHaveBeenCalledTimes(1);
  });
  it("rejects unsupported formats and images over 8 MB before upload", async () => {
    expect(await uploadDataUrl("data:image/svg+xml;base64,YQ==")).toBeNull();
    expect(await uploadDataUrl(`data:image/png;base64,${Buffer.alloc(8 * 1024 * 1024 + 1).toString("base64")}`)).toBeNull();
    expect(storage.upload).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
