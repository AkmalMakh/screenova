import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), provider: vi.fn() }));
vi.mock("@/lib/supabase/access", () => ({ authorizeRequest: mocks.authorize }));
vi.mock("openai", () => ({ default: mocks.provider }));
import { POST as redesign } from "./route";
import { POST as analyze } from "./analyze-screenshots/route";
import { POST as suggest } from "./suggest-deck/route";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("OPENAI_API_KEY", "unit-test-never-used");
  mocks.authorize.mockResolvedValue({ userId: null, client: null });
});
afterEach(() => vi.unstubAllEnvs());
const routes = [redesign, analyze, suggest];
const request = (body: string) => new Request("https://screenova.example/api/design", { method: "POST", body });

describe("AI route authorization and validation boundaries", () => {
  it("propagates auth, membership, stale-account, quota and outage denials before provider work", async () => {
    for (const status of [401, 403, 409, 429, 503]) {
      for (const route of routes) {
        const denied = new Response("Denied", { status });
        mocks.authorize.mockResolvedValue( { response: denied });
        const req = request("invalid json");
        expect(await route(req)).toBe(denied);
        expect(mocks.authorize).toHaveBeenLastCalledWith(req, "ai");
      }
    }
    expect(mocks.provider).not.toHaveBeenCalled();
  });
  it("returns a recoverable configuration error without initializing the provider", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    for (const route of routes) expect((await route(request("{}"))).status).toBe(503);
    expect(mocks.provider).not.toHaveBeenCalled();
  });
  it("rejects malformed JSON and null bodies before initializing the provider", async () => {
    for (const route of routes) {
      expect((await route(request("{"))).status).toBe(400);
      expect((await route(request("null"))).status).toBe(400);
    }
    expect(mocks.provider).not.toHaveBeenCalled();
  });
  it("rejects arbitrary remote screenshot reads and non-Apple reference images", async () => {
    const screenshots = [{ name: "private", path: "https://attacker.example/private.png" }];
    expect((await analyze(request(JSON.stringify({ appName: "App", locales: ["en"], screenshots })))).status).toBe(400);
    const draft = { messages: [{ role: "user", text: "Draft an app" }], locales: ["en"], device: "iphone" };
    expect((await suggest(request(JSON.stringify({ ...draft, screenshots })))).status).toBe(400);
    expect((await suggest(request(JSON.stringify({ ...draft, styleReferences: [{ name: "Example", url: "https://example.com", screenshotUrls: ["https://attacker.example/private.png"] }] })))).status).toBe(400);
    expect(mocks.provider).not.toHaveBeenCalled();
  });
});
