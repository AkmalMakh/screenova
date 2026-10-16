import { afterEach, describe, expect, it, vi } from "vitest";
import { storageMode } from "./config";

afterEach(() => vi.unstubAllEnvs());

describe("Vercel deployment boundary", () => {
  it("never permits a local workspace on the hosted runtime", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("APP_STORAGE_MODE", "local");
    expect(storageMode()).toBe("supabase");
    vi.stubEnv("APP_STORAGE_MODE", "");
    expect(storageMode()).toBe("supabase");
  });

  it("preserves explicit local operation outside Vercel", () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("APP_STORAGE_MODE", "local");
    expect(storageMode()).toBe("local");
  });
});
