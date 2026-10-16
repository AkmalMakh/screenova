import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSignInOptions } from "./sign-in-options";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co/");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
  vi.stubEnv("AUTH_EMAIL_ENABLED", "false");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const settings = (external: unknown) => vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ external })));

describe("enabled sign-in discovery", () => {
  it.each([false, true])("enables Google independently of GitHub=%s", async (github) => {
    settings({ google: true, github, email: true });
    expect(await getSignInOptions()).toEqual({ google: true, github, email: false });
  });
  it("enables GitHub only from the actual provider settings, without SMTP", async () => {
    settings({ github: true, email: true });
    expect(await getSignInOptions()).toEqual({ google: false, github: true, email: false });
    expect(fetch).toHaveBeenCalledWith("https://project.supabase.co/auth/v1/settings", expect.objectContaining({
      headers: { apikey: "public-test-key" }, cache: "no-store", signal: expect.any(AbortSignal),
    }));
  });
  it("requires both an operator opt-in and an enabled provider for email", async () => {
    vi.stubEnv("AUTH_EMAIL_ENABLED", "true");
    settings({ github: false, email: true });
    expect(await getSignInOptions()).toEqual({ google: false, github: false, email: true });
    settings({ google: false, github: false, email: false });
    expect(await getSignInOptions()).toEqual({ google: false, github: false, email: false });
  });
  it("does not treat malformed settings as enabled", async () => {
    settings({ google: "true", github: "true", email: "true" });
    expect(await getSignInOptions()).toEqual({ google: false, github: false, email: false });
    settings(null);
    expect(await getSignInOptions()).toEqual({ google: false, github: false, email: false });
  });
  it("fails closed on provider HTTP failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })));
    expect(await getSignInOptions()).toEqual({ google: false, github: false, email: false });
  });
  it("fails closed on timeout, malformed JSON and missing configuration", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    expect(await getSignInOptions()).toEqual({ google: false, github: false, email: false });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json")));
    expect(await getSignInOptions()).toEqual({ google: false, github: false, email: false });
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.mocked(fetch).mockClear();
    expect(await getSignInOptions()).toEqual({ google: false, github: false, email: false });
    expect(fetch).not.toHaveBeenCalled();
  });
});
