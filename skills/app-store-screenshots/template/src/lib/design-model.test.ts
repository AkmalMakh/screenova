import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const mocks = vi.hoisted(() => ({ stream: vi.fn(), finalMessage: vi.fn(), on: vi.fn(), report: vi.fn() }));
// Keep the real error classes so the error mapping sees what the SDK throws.
vi.mock("@anthropic-ai/sdk", async () => {
  const actual = await vi.importActual<typeof import("@anthropic-ai/sdk")>("@anthropic-ai/sdk");
  class FakeAnthropic {
    messages = { stream: (...args: unknown[]) => { mocks.stream(...args); return { finalMessage: mocks.finalMessage, on: mocks.on }; } };
  }
  return { ...actual, default: Object.assign(FakeAnthropic, { APIError: actual.APIError, APIUserAbortError: actual.APIUserAbortError }) };
});
vi.mock("./ops", () => ({ report: mocks.report, requestIdOf: () => "iad1::req" }));

import sharp from "sharp";
import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_IMAGE_EDGE, designConfigError, designModel, fitForClaude, generateDesign, isProviderError } from "./design-model";
import { AI_PAUSED, claudeErrorResponse } from "./openai-errors";

const schema = z.object({ title: z.string() });
const reply = (parsed_output: unknown, stop_reason = "end_turn") => ({
  model: "claude-test",
  stop_reason,
  parsed_output,
  usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, output_tokens_details: null },
});
const png = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 4, background: { r: 30, g: 60, b: 200, alpha: 1 } } }).png().toBuffer();

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe("which model designs", () => {
  it("keeps OpenAI unless Claude is switched on", () => {
    expect(designModel("draft")).toBe("gpt-5.6-terra");
    expect(designModel("edit")).toBe("gpt-5.6-terra");
  });

  it("gives first drafts Opus at high effort and edits the faster model", () => {
    vi.stubEnv("DESIGN_PROVIDER", "anthropic");
    expect(designModel("draft")).toBe("claude-opus-5-5");
    expect(designModel("edit")).toBe("claude-sonnet-5-5");
    vi.stubEnv("ANTHROPIC_DRAFT_MODEL", "claude-fable-5-1");
    expect(designModel("draft")).toBe("claude-fable-5-1");
  });

  it("asks for the key the chosen provider needs", () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(designConfigError()).toContain("OPENAI_API_KEY");
    vi.stubEnv("DESIGN_PROVIDER", "anthropic");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(designConfigError()).toContain("ANTHROPIC_API_KEY");
    vi.stubEnv("ANTHROPIC_API_KEY", "unit-test-never-used");
    expect(designConfigError()).toBeNull();
  });
});

describe("drafting with Claude", () => {
  beforeEach(() => {
    vi.stubEnv("DESIGN_PROVIDER", "anthropic");
    vi.stubEnv("ANTHROPIC_API_KEY", "unit-test-never-used");
  });

  it("sends a draft at high effort, with shrunk screenshots and remote references, and returns the parsed design", async () => {
    mocks.finalMessage.mockResolvedValue(reply({ title: "Plan your day" }));
    const screenshot = `data:image/png;base64,${(await png(1290, 2796)).toString("base64")}`;

    const result = await generateDesign({
      task: "draft",
      system: "DECK RULES",
      content: [
        { type: "text", text: "SCREENSHOT 1 of 1" },
        { type: "image", url: screenshot },
        { type: "image", url: "https://is1-ssl.mzstatic.com/image/thumb/ref.png", detail: "high" },
      ],
      schema,
      name: "deck",
    });

    expect(result).toEqual({ title: "Plan your day" });
    const [params] = mocks.stream.mock.calls[0] as [Anthropic.MessageCreateParams];
    expect(params.model).toBe("claude-opus-5-5");
    expect(params.output_config?.effort).toBe("high");
    expect(params.output_config?.format?.type).toBe("json_schema");
    // Draft prompts differ per request, so they are not cached.
    expect(params.system).toEqual([{ type: "text", text: "DECK RULES" }]);
    const [text, inline, remote] = params.messages[0].content as Anthropic.ContentBlockParam[];
    expect(text).toEqual({ type: "text", text: "SCREENSHOT 1 of 1" });
    expect(remote).toEqual({ type: "image", source: { type: "url", url: "https://is1-ssl.mzstatic.com/image/thumb/ref.png" } });
    const source = (inline as Anthropic.ImageBlockParam).source as Anthropic.Base64ImageSource;
    expect(source.media_type).toBe("image/jpeg");
    const { width, height } = await sharp(Buffer.from(source.data, "base64")).metadata();
    expect(height).toBe(CLAUDE_IMAGE_EDGE);
    expect(width).toBeLessThan(CLAUDE_IMAGE_EDGE);
  });

  it("caches the fixed chat prompt and uses the faster model for edits", async () => {
    mocks.finalMessage.mockResolvedValue(reply({ title: "x" }));
    await generateDesign({ task: "edit", system: "CHAT RULES", content: [{ type: "text", text: "make it bolder" }], schema, name: "edit" });
    const [params] = mocks.stream.mock.calls[0] as [Anthropic.MessageCreateParams];
    expect(params.model).toBe("claude-sonnet-5-5");
    expect(params.output_config?.effort).toBe("medium");
    expect(params.system).toEqual([{ type: "text", text: "CHAT RULES", cache_control: { type: "ephemeral" } }]);
  });

  it("passes the reply's text along as it streams, only when asked", async () => {
    mocks.finalMessage.mockResolvedValue(reply({ title: "x" }));
    const onText = vi.fn();
    await generateDesign({ task: "draft", system: "s", content: [], schema, name: "deck", onText });
    expect(mocks.on).toHaveBeenCalledWith("text", onText);
    mocks.on.mockClear();
    await generateDesign({ task: "draft", system: "s", content: [], schema, name: "deck" });
    expect(mocks.on).not.toHaveBeenCalled();
  });

  it("treats a cut-off or refused design as a failed draft the route can retry", async () => {
    for (const stop_reason of ["max_tokens", "refusal"]) {
      mocks.finalMessage.mockResolvedValueOnce(reply(null, stop_reason));
      const failure = generateDesign({ task: "draft", system: "s", content: [], schema, name: "deck" });
      await expect(failure).rejects.toThrow(Error);
    }
    expect(isProviderError(new Error("cut off"))).toBe(false);
    expect(isProviderError(new Anthropic.APIError(500, undefined, "down", undefined))).toBe(true);
  });
});

describe("schemas too large for Claude's guaranteed JSON", () => {
  beforeEach(() => {
    vi.stubEnv("DESIGN_PROVIDER", "anthropic");
    vi.stubEnv("ANTHROPIC_API_KEY", "unit-test-never-used");
  });
  const tooLarge = () =>
    Anthropic.APIError.generate(400, { type: "error", error: { type: "invalid_request_error", message: "The compiled grammar is too large, which would cause performance issues." } }, "The compiled grammar is too large", new Headers());
  const text = (body: string) => ({ ...reply(null), content: [{ type: "text", text: body }] });

  it("asks for plain JSON with the schema in the prompt, validates it, and remembers the schema", async () => {
    mocks.finalMessage.mockRejectedValueOnce(tooLarge()).mockResolvedValueOnce(text('```json\n{"title":"Plan your day"}\n```'));
    const request = { task: "draft" as const, system: "DECK RULES", content: [], schema, name: "big_deck" };

    expect(await generateDesign(request)).toEqual({ title: "Plan your day" });
    const [structured, prompted] = mocks.stream.mock.calls.map(([params]) => params as Anthropic.MessageCreateParams);
    expect(structured.output_config?.format?.type).toBe("json_schema");
    expect(prompted.output_config?.format).toBeUndefined();
    expect(prompted.output_config?.effort).toBe("high");
    const prompt = (prompted.system as Anthropic.TextBlockParam[])[0].text;
    expect(prompt.startsWith("DECK RULES")).toBe(true);
    expect(prompt).toContain('"title"');

    // The next request with this schema skips the refused call.
    mocks.finalMessage.mockResolvedValueOnce(text('{"title":"Second"}'));
    expect(await generateDesign(request)).toEqual({ title: "Second" });
    expect(mocks.stream).toHaveBeenCalledTimes(3);
  });

  it("rejects prose or a design that doesn't match the schema, so the route retries", async () => {
    mocks.finalMessage.mockRejectedValueOnce(tooLarge());
    mocks.finalMessage.mockResolvedValueOnce(text("Here is your deck!"));
    await expect(generateDesign({ task: "draft", system: "s", content: [], schema, name: "prose_deck" })).rejects.toThrow("no design");
    mocks.finalMessage.mockResolvedValueOnce(text('{"title": 7}'));
    await expect(generateDesign({ task: "draft", system: "s", content: [], schema, name: "prose_deck" })).rejects.toThrow(/invalid design \(title/);
  });

  it("trims an overlong field instead of throwing away the whole draft", async () => {
    const strict = z.object({ summary: z.string().max(10), scale: z.number().max(2), tags: z.array(z.string()).max(1) });
    mocks.finalMessage.mockRejectedValueOnce(tooLarge());
    mocks.finalMessage.mockResolvedValueOnce(text('{"summary":"A very long summary","scale":9,"tags":["a","b","c"]}'));
    expect(await generateDesign({ task: "draft", system: "s", content: [], schema: strict, name: "overrun_deck" })).toEqual({ summary: "A very lon", scale: 2, tags: ["a"] });
    expect(mocks.stream).toHaveBeenCalledTimes(2);
  });

  it("passes other provider errors straight through", async () => {
    mocks.finalMessage.mockRejectedValueOnce(Anthropic.APIError.generate(500, { type: "error", error: { type: "api_error", message: "down" } }, "down", new Headers()));
    await expect(generateDesign({ task: "draft", system: "s", content: [], schema, name: "outage_deck" })).rejects.toBeInstanceOf(Anthropic.APIError);
    expect(mocks.stream).toHaveBeenCalledTimes(1);
  });
});

describe("fitting images for Claude", () => {
  it("leaves small supported images untouched", async () => {
    const small = await png(400, 800);
    expect(await fitForClaude("image/png", small)).toEqual({ mime: "image/png", data: small });
  });

  it("shrinks large captures to the long-edge limit as JPEG", async () => {
    const fitted = await fitForClaude("image/png", await png(1320, 2868));
    expect(fitted.mime).toBe("image/jpeg");
    const { width = 0, height = 0 } = await sharp(fitted.data).metadata();
    expect(Math.max(width, height)).toBe(CLAUDE_IMAGE_EDGE);
  });
});

describe("Claude error mapping", () => {
  const vendor = (status: number, type: string, message = "vendor says no") =>
    Anthropic.APIError.generate(status, { type: "error", error: { type, message } }, message, new Headers());
  const UNAVAILABLE = "The AI could not draft a template right now. Try again.";

  it.each([
    { name: "spent prepaid balance", error: () => vendor(400, "invalid_request_error", "Your credit balance is too low to access the Anthropic API."), status: 503, copy: AI_PAUSED, reported: "ai_quota" },
    { name: "billing error", error: () => vendor(402, "billing_error"), status: 503, copy: AI_PAUSED, reported: "ai_quota" },
    { name: "rate limit", error: () => vendor(429, "rate_limit_error"), status: 429, copy: "Screenova AI is busy right now. Try again shortly.", reported: null },
    { name: "overloaded", error: () => vendor(529, "overloaded_error"), status: 503, copy: "Screenova AI is busy right now. Try again shortly.", reported: null },
    { name: "rejected key", error: () => vendor(401, "authentication_error"), status: 401, copy: "Screenova AI isn't available right now. Try again later.", reported: "ai_provider" },
    { name: "missing model", error: () => vendor(404, "not_found_error"), status: 404, copy: UNAVAILABLE, reported: "ai_provider" },
    { name: "outage", error: () => vendor(500, "api_error"), status: 500, copy: UNAVAILABLE, reported: "ai_provider" },
    { name: "unreadable image", error: () => vendor(400, "invalid_request_error", "Could not process image"), status: 400, copy: "One of the images couldn't be read. Try a PNG or JPEG screenshot.", reported: null },
    { name: "other bad input", error: () => vendor(400, "invalid_request_error"), status: 400, copy: "Screenova AI couldn't process this request. Try different screenshots or wording.", reported: null },
  ])("$name", async ({ error, status, copy, reported }) => {
    const response = claudeErrorResponse(error(), UNAVAILABLE)!;
    expect(response.status).toBe(status);
    expect((await response.json()).error).toBe(copy);
    if (reported) expect(mocks.report.mock.calls[0][0]).toBe(reported);
    else expect(mocks.report).not.toHaveBeenCalled();
  });

  it("leaves a user's cancel and non-Claude errors to the caller", () => {
    expect(claudeErrorResponse(new Anthropic.APIUserAbortError(), UNAVAILABLE)).toBeNull();
    expect(claudeErrorResponse(new Error("schema mismatch"), UNAVAILABLE)).toBeNull();
  });
});
