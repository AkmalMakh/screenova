import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), generate: vi.fn(), report: vi.fn() }));
vi.mock("@/lib/supabase/access", () => ({ authorizeRequest: mocks.authorize }));
vi.mock("@/lib/ops", () => ({ report: mocks.report, requestIdOf: () => null }));
vi.mock("@/lib/design-model", async () => {
  const actual = await vi.importActual<typeof import("@/lib/design-model")>("@/lib/design-model");
  return { ...actual, designConfigError: () => null, generateDesign: mocks.generate };
});

import Anthropic from "@anthropic-ai/sdk";
import { POST } from "./route";

const post = (body: unknown) => POST(new Request("https://screenova.example/api/design/translate", { method: "POST", body: JSON.stringify(body) }));
const items = [
  { id: "t1", kind: "label", text: "PLAN" },
  { id: "t2", kind: "headline", text: "Plan your day" },
];

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  mocks.authorize.mockResolvedValue({ userId: null, client: null });
});

describe("writing new languages", () => {
  it("charges one edit and writes each language in its own call, keyed by source text", async () => {
    mocks.generate.mockImplementation(async ({ system }: { system: string }) => {
      const german = system.includes("Deutsch");
      return { items: [{ id: "t1", text: german ? "PLANEN" : "계획" }, { id: "t2", text: german ? "Plane deinen Tag" : "하루를 계획하세요" }, { id: "t9", text: "stray" }] };
    });
    const response = await post({ appName: "Mote", source: "en", targets: ["de", "ko", "en"], items });
    expect(mocks.authorize).toHaveBeenCalledWith(expect.any(Request), "ai_edit");
    expect(mocks.generate).toHaveBeenCalledTimes(2);
    expect(mocks.generate.mock.calls[0][0]).toMatchObject({ task: "edit" });
    expect(await response.json()).toEqual({
      ok: true,
      failed: [],
      translations: { PLAN: { de: "PLANEN", ko: "계획" }, "Plan your day": { de: "Plane deinen Tag", ko: "하루를 계획하세요" } },
    });
  });

  it("keeps the languages that worked when one fails", async () => {
    mocks.generate.mockImplementation(async ({ system }: { system: string }) => {
      if (system.includes("Français")) throw new Error("bad reply");
      return { items: [{ id: "t2", text: "Plane deinen Tag" }] };
    });
    const json = await (await post({ source: "en", targets: ["de", "fr"], items })).json();
    expect(json).toMatchObject({ ok: true, failed: ["fr"], translations: { "Plan your day": { de: "Plane deinen Tag" } } });
  });

  it("maps a provider outage when every language fails", async () => {
    mocks.generate.mockRejectedValue(Anthropic.APIError.generate(529, { type: "error", error: { type: "overloaded_error", message: "busy" } }, "busy", new Headers()));
    expect((await post({ source: "en", targets: ["de"], items })).status).toBe(503);
  });

  it("rejects languages outside the supported set before calling the AI", async () => {
    expect((await post({ source: "en", targets: ["xx"], items })).status).toBe(400);
    expect((await post({ source: "en", targets: ["de"], items: [] })).status).toBe(400);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
});
