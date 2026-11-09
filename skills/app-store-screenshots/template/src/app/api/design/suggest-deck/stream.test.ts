import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), generate: vi.fn(), report: vi.fn() }));
vi.mock("@/lib/supabase/access", () => ({ authorizeRequest: mocks.authorize }));
vi.mock("@/lib/ops", () => ({ report: mocks.report, requestIdOf: () => null }));
vi.mock("@/lib/design-model", async () => {
  const actual = await vi.importActual<typeof import("@/lib/design-model")>("@/lib/design-model");
  return { ...actual, designConfigError: () => null, generateDesign: mocks.generate };
});

import Anthropic from "@anthropic-ai/sdk";
import type { DraftEvent } from "@/lib/deck-stream";
import { POST } from "./route";

const slide = (headline: string) => ({
  layout: "no-device",
  backgroundFill: null,
  frameStyle: null,
  headlineStyle: null,
  copy: { en: { label: "", headline }, de: { label: "", headline: `${headline} (de)` } },
  headlineFontFamily: null,
  inverted: null,
  deviceTransform: null,
  captionTransform: null,
  textElements: [],
  decorations: [],
});
const deck = {
  appName: "Mote",
  themeId: "dark-bold",
  theme: { name: "Night", bg: "#101010", bgAlt: "#202020", fg: "#ffffff", fgAlt: "#ffffff", accent: "#7c5cff", muted: "#999999" },
  summary: "Three dark screens.",
  slides: [slide("Plan your day"), slide("Track spending"), slide("Log your cycle")],
};
const body = { messages: [{ role: "user", text: "A calendar app" }], locales: ["en", "de"], device: "iphone", count: 3, stream: true };

async function events(response: Response): Promise<DraftEvent[]> {
  const text = await response.text();
  return text.split("\n").filter(Boolean).map((line) => JSON.parse(line) as DraftEvent);
}

// Writes the reply in small pieces, the way Claude streams it.
function streamReply(reply: unknown) {
  return async ({ onText }: { onText?: (delta: string) => void }) => {
    const text = JSON.stringify(reply);
    for (let i = 0; i < text.length; i += 40) onText?.(text.slice(i, i + 40));
    return reply;
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  mocks.authorize.mockResolvedValue({ userId: null, client: null });
});

describe("streamed first draft", () => {
  it("sends the theme and each screen as they are written, then the validated deck", async () => {
    mocks.generate.mockImplementation(streamReply(deck));
    const response = await POST(new Request("https://screenova.example/api/design/suggest-deck", { method: "POST", body: JSON.stringify(body) }));
    expect(response.headers.get("content-type")).toBe("application/x-ndjson");
    const sent = (await events(response)).filter((event) => event.type !== "ping");
    expect(sent.map((event) => event.type)).toEqual(["start", "theme", "slide", "slide", "slide", "done"]);
    expect(sent[0]).toEqual({ type: "start", count: 3 });
    expect(sent[1]).toMatchObject({ type: "theme", appName: "Mote", themeId: "dark-bold", customTheme: { bg: "#101010" } });
    const screens = sent.filter((event) => event.type === "slide");
    expect(screens.map((event) => event.index)).toEqual([0, 1, 2]);
    expect(screens[1]).toMatchObject({ slide: { copy: { en: { headline: "Track spending" }, de: { headline: "Track spending (de)" } } } });
    expect(sent[5]).toMatchObject({ type: "done", deck: { appName: "Mote", slides: expect.any(Array) } });
  });

  it("tells the editor to start over when the first reply fails validation", async () => {
    mocks.generate.mockImplementationOnce(streamReply({ ...deck, slides: deck.slides.slice(0, 1) })).mockImplementationOnce(streamReply(deck));
    const response = await POST(new Request("https://screenova.example/api/design/suggest-deck", { method: "POST", body: JSON.stringify(body) }));
    const types = (await events(response)).map((event) => event.type).filter((type) => type !== "ping");
    expect(types).toEqual(["start", "theme", "slide", "retry", "theme", "slide", "slide", "slide", "done"]);
  });

  it("ends with an error event carrying the provider's status", async () => {
    mocks.generate.mockRejectedValue(Anthropic.APIError.generate(529, { type: "error", error: { type: "overloaded_error", message: "busy" } }, "busy", new Headers()));
    const response = await POST(new Request("https://screenova.example/api/design/suggest-deck", { method: "POST", body: JSON.stringify(body) }));
    expect(response.status).toBe(200);
    const last = (await events(response)).at(-1);
    expect(last).toMatchObject({ type: "error", status: 503 });
    expect(mocks.report).not.toHaveBeenCalledWith("ai_template_failed", expect.anything(), expect.anything());
  });
});
