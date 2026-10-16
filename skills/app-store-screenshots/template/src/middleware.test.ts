import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ create: vi.fn(), user: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.create }));
import { middleware } from "./middleware";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_STORAGE_MODE", "supabase");
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-public-key");
  mocks.create.mockReturnValue({ auth: { getUser: mocks.user } });
  mocks.user.mockResolvedValue({ data: { user: { id: "alice" } }, error: null });
});
afterEach(() => vi.unstubAllEnvs());
const request = (path: string) => new NextRequest(`https://screenova.example${path}`);

describe("protected-route middleware", () => {
  it("allows explicit local operation without initializing hosted auth", async () => {
    vi.stubEnv("APP_STORAGE_MODE", "local");
    expect((await middleware(request("/studio"))).headers.get("x-middleware-next")).toBe("1");
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("blocks personal screenshot URLs before any hosted service call", async () => {
    expect((await middleware(request("/screenshots/uploaded/private.png"))).status).toBe(404);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("denies anonymous API requests and redirects anonymous editor navigation", async () => {
    mocks.user.mockResolvedValue({ data: { user: null }, error: null });
    const api = await middleware(request("/api/project"));
    expect(api.status).toBe(401);
    expect(api.headers.get("cache-control")).toBe("private, no-store");
    expect((await middleware(request("/editor"))).headers.get("location")).toBe("https://screenova.example/login");
  });
  it("propagates refreshed session cookies for an authenticated request", async () => {
    mocks.create.mockImplementation((_url, _key, options) => {
      options.cookies.setAll([{ name: "session", value: "fresh", options: { httpOnly: true, path: "/" } }]);
      return { auth: { getUser: mocks.user } };
    });
    const req = request("/studio");
    const response = await middleware(req);
    expect(req.cookies.get("session")?.value).toBe("fresh");
    expect(response.cookies.get("session")?.value).toBe("fresh");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("preserves cleared cookies when refresh rejects the session", async () => {
    mocks.create.mockImplementation((_url, _key, options) => {
      options.cookies.setAll([{ name: "session", value: "", options: { maxAge: 0, path: "/" } }]);
      return { auth: { getUser: mocks.user } };
    });
    mocks.user.mockResolvedValue({ data: { user: null }, error: new Error("expired") });
    const response = await middleware(request("/studio"));
    expect(response.headers.get("location")).toBe("https://screenova.example/login");
    expect(response.cookies.get("session")?.maxAge).toBe(0);
  });
  it("fails closed without config or during an auth outage", async () => {
    mocks.user.mockRejectedValue(new Error("offline"));
    expect((await middleware(request("/api/project"))).status).toBe(503);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    mocks.create.mockClear();
    expect((await middleware(request("/studio"))).status).toBe(503);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
