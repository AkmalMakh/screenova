import { beforeEach, describe, expect, it, vi } from "vitest";
const { exchange } = vi.hoisted(() => ({ exchange: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ serverSupabase: async () => ({ auth: { exchangeCodeForSession: exchange } }) }));
import { GET } from "./route";

beforeEach(() => { exchange.mockReset(); });
describe("PKCE auth callback", () => {
  it("exchanges the code and uses a fixed private workspace destination", async () => {
    exchange.mockResolvedValue({ error: null });
    const response = await GET(new Request("https://screenova.example/auth/callback?code=test-code&next=https://evil.example"));
    expect(exchange).toHaveBeenCalledWith("test-code");
    expect(response.headers.get("location")).toBe("https://screenova.example/studio");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("handles a declined GitHub consent without exchanging a code", async () => {
    const response = await GET(new Request("https://screenova.example/auth/callback?error=access_denied&code=unused"));
    expect(response.headers.get("location")).toBe("https://screenova.example/login?reason=cancelled");
    expect(exchange).not.toHaveBeenCalled();
  });
  it("does not reflect provider error details into the redirect", async () => {
    const response = await GET(new Request("https://screenova.example/auth/callback?error=provider_failure&error_description=secret"));
    expect(response.headers.get("location")).toBe("https://screenova.example/login?reason=oauth");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it.each(["missing", "rejected", "exception"])("handles %s codes without granting a session", async (failure) => {
    if (failure === "exception") exchange.mockRejectedValue(new Error("private provider detail"));
    else exchange.mockResolvedValue({ error: new Error("invalid code") });
    const response = await GET(new Request(`https://screenova.example/auth/callback${failure === "missing" ? "" : "?code=bad"}`));
    expect(response.headers.get("location")).toBe("https://screenova.example/login?reason=expired");
  });
});
