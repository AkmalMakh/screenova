import { afterEach, describe, expect, it, vi } from "vitest";
import { assetKey } from "./assets";
import { storageMode, supabaseConfig } from "./config";
import { scopedKey, setAccountScope, apiFetch } from "../account-scope";
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); setAccountScope(null); });
describe("cloud boundaries", () => {
  it("fails closed in production and preserves explicit local development", () => {
    vi.stubEnv("APP_STORAGE_MODE", ""); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ""); vi.stubEnv("NODE_ENV", "production");
    expect(storageMode()).toBe("supabase"); expect(() => supabaseConfig()).toThrow();
    vi.stubEnv("APP_STORAGE_MODE", "local"); expect(storageMode()).toBe("local");
    vi.stubEnv("APP_STORAGE_MODE", "typo"); expect(() => storageMode()).toThrow();
  });
  it("rejects other owners, traversal, encoded paths and external URLs", () => {
    expect(assetKey("/api/assets/alice/abc.png", "alice")).toBe("alice/abc.png");
    for (const url of ["/api/assets/bob/a.png", "/api/assets/alice/../b.png", "/api/assets/alice/%2e%2e/b.png", "/screenshots/uploaded/a.png", "https://example.com/a.png", "/api/assets/alice//a.png"]) expect(() => assetKey(url, "alice")).toThrow();
  });
  it("namespaces caches and binds API requests to the page's account", async () => {
    expect(scopedKey("projects")).toBe("projects");
    setAccountScope("alice"); expect(scopedKey("projects")).toBe("screenova:alice:projects");
    const mock = vi.fn().mockResolvedValue(new Response()); vi.stubGlobal("fetch", mock);
    await apiFetch("/api/project", { method: "POST" });
    expect(mock.mock.calls[0][1].headers.get("x-screenova-owner")).toBe("alice");
    setAccountScope("bob"); expect(scopedKey("projects")).toBe("screenova:bob:projects");
  });
});
