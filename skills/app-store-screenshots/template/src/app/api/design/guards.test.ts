import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), provider: vi.fn(), parse: vi.fn(), generate: vi.fn(), normalize: vi.fn(), report: vi.fn() }));
vi.mock("@/lib/supabase/access", () => ({ authorizeRequest: mocks.authorize }));
vi.mock("@/lib/supabase/assets", async () => {
  const actual = await vi.importActual<typeof import("@/lib/supabase/assets")>("@/lib/supabase/assets");
  // A 1x1 PNG stands in for a stored screenshot so the analyze route reaches the provider.
  return { ...actual, readAsset: async () => Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64") };
});
vi.mock("@/lib/ops", () => ({ report: mocks.report, requestIdOf: (req?: Request) => req?.headers.get("x-vercel-id") ?? null }));
// Keep the real APIError classes so routes see the same errors OpenAI throws.
vi.mock("openai", async () => {
  const actual = await vi.importActual<typeof import("openai")>("openai");
  return { ...actual, default: Object.assign(mocks.provider, { APIError: actual.APIError }) };
});
vi.mock("@/lib/design", async () => {
  const actual = await vi.importActual<typeof import("@/lib/design")>("@/lib/design");
  return { ...actual, normalizeDesignResponse: mocks.normalize };
});
import { APIError, APIUserAbortError } from "openai";
import { AI_PAUSED } from "@/lib/openai-errors";
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

describe("AI routes surface OpenAI quota exhaustion honestly", () => {
  const quota = () => APIError.generate(429, { error: { message: "quota", code: "insufficient_quota" } }, "quota", new Headers());
  const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.provider.mockImplementation(function () {
      return { responses: { parse: mocks.parse }, images: { generate: mocks.generate } };
    });
  });
  it("maps a quota failure in the screenshot analysis route to the paused-AI copy", async () => {
    mocks.parse.mockRejectedValue(quota());
    const body = { appName: "Calendar", locales: ["en"], screenshots: [{ name: "Calendar", path: "/screenshots/uploaded/calendar.png" }] };
    const response = await analyze(request(JSON.stringify(body)));
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe(AI_PAUSED);
  });
  it("maps a quota failure in the deck suggestion route to the paused-AI copy", async () => {
    mocks.parse.mockRejectedValue(quota());
    const body = { messages: [{ role: "user", text: "Draft a fitness app deck" }], locales: ["en"], device: "iphone" };
    const response = await suggest(request(JSON.stringify(body)));
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe(AI_PAUSED);
  });
  it("maps a quota failure from the image model during a redesign the same way", async () => {
    mocks.parse.mockResolvedValue({ output_parsed: {} });
    mocks.normalize.mockReturnValue({ targetSlideIds: ["s1"], slidePatches: [{ slideId: "s1", visualAssetPrompt: "soft gradient sky" }], newSlides: [] });
    mocks.generate.mockRejectedValue(quota());
    const body = {
      prompt: "Make it calmer",
      project: { device: "iphone", locale: "en", orientation: "portrait", slidesByDevice: { iphone: [{ id: "s1" }] } },
      scope: { type: "current", slideIds: ["s1"] },
      renderedPreviews: [{ slideId: "s1", dataUrl: PNG }],
      references: [],
    };
    const response = await redesign(request(JSON.stringify(body)));
    expect(mocks.generate).toHaveBeenCalled();
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe(AI_PAUSED);
  });
});

// Value: protects=operators are paged only for real AI failures, each under the route's own runbook stage; fails_when=a user cancel or a non-provider failure is misfiled or unreported
// why_new=existing route tests cover only quota mapping; the helper unit test never sees an aborted request; seam=none; no_claim=Sentry delivery, client UI on cancel
describe("AI routes page operators only for real failures", () => {
  const draft = { messages: [{ role: "user", text: "Draft a fitness app deck" }], locales: ["en"], device: "iphone" };
  const redesignBody = {
    prompt: "Make it calmer",
    project: { device: "iphone", locale: "en", orientation: "portrait", slidesByDevice: { iphone: [{ id: "s1" }] } },
    scope: { type: "current", slideIds: ["s1"] },
    renderedPreviews: [{ slideId: "s1", dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" }],
    references: [],
  };
  const analyzeBody = { appName: "Calendar", locales: ["en"], screenshots: [{ name: "Calendar", path: "/screenshots/uploaded/calendar.png" }] };
  const cases = [
    { name: "deck suggestion", route: suggest, body: draft, stage: "ai_template_failed" },
    { name: "redesign", route: redesign, body: redesignBody, stage: "ai_design_failed" },
    { name: "screenshot analysis", route: analyze, body: analyzeBody, stage: "ai_analysis_failed" },
  ];
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.provider.mockImplementation(function () {
      return { responses: { parse: mocks.parse }, images: { generate: mocks.generate } };
    });
  });
  it.each(cases)("$name: a user cancel mid-request is a quiet 499, not a provider alert", async ({ route, body }) => {
    const controller = new AbortController();
    controller.abort();
    mocks.parse.mockRejectedValue(new APIUserAbortError());
    const req = new Request("https://screenova.example/api/design", { method: "POST", body: JSON.stringify(body), signal: controller.signal });
    const response = await route(req);
    expect(mocks.parse).toHaveBeenCalled();
    expect(mocks.report).not.toHaveBeenCalled();
    expect(response.status).toBe(499);
  });
  it.each(cases)("$name: a non-provider failure pages under $stage and returns 502", async ({ route, body, stage }) => {
    mocks.parse.mockResolvedValue({ output_parsed: null });
    const req = new Request("https://screenova.example/api/design", { method: "POST", body: JSON.stringify(body), headers: { "x-vercel-id": "iad1::req9" } });
    const response = await route(req);
    expect(response.status).toBe(502);
    expect(mocks.report).toHaveBeenCalledTimes(1);
    expect(mocks.report).toHaveBeenCalledWith(stage, expect.any(Error), { requestId: "iad1::req9" });
  });
});
