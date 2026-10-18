import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as OpenAIModule from "openai";
import type * as ErrorsModule from "./openai-errors";

const mocks = vi.hoisted(() => ({ report: vi.fn() }));
vi.mock("./ops", () => ({ report: mocks.report, requestIdOf: () => "iad1::req" }));

// Fresh modules per test; the SDK is re-imported alongside so error classes
// match the module's.
let APIError: typeof OpenAIModule.APIError;
let APIUserAbortError: typeof OpenAIModule.APIUserAbortError;
let APIConnectionError: typeof OpenAIModule.APIConnectionError;
let APIConnectionTimeoutError: typeof OpenAIModule.APIConnectionTimeoutError;
let AI_PAUSED: string;
let AI_REJECTED: string;
let openAIErrorResponse: typeof ErrorsModule.openAIErrorResponse;

const vendor = (status: number, code?: string, message = "vendor says no") =>
  APIError.generate(status, { error: { message, code } }, message, new Headers());
const UNAVAILABLE = "OpenAI could not generate a design right now. Try again.";

beforeEach(async () => {
  vi.resetAllMocks();
  vi.resetModules();
  ({ APIError, APIUserAbortError, APIConnectionError, APIConnectionTimeoutError } = await import("openai"));
  ({ AI_PAUSED, AI_REJECTED, openAIErrorResponse } = await import("./openai-errors"));
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("OpenAI error mapping (every branch pinned before and after the quota change)", () => {
  it.each([
    { name: "rejected key", status: 401, code: undefined, expectStatus: 401, copy: "The OpenAI API key was rejected.", reported: "ai_provider" },
    { name: "transient rate limit", status: 429, code: "rate_limit_exceeded", expectStatus: 429, copy: "OpenAI is rate-limited right now. Try again shortly.", reported: null },
    { name: "monthly hard limit", status: 429, code: "insufficient_quota", expectStatus: 503, copy: "<AI_PAUSED>", reported: "ai_quota" },
    { name: "provider outage", status: 500, code: undefined, expectStatus: 500, copy: UNAVAILABLE, reported: "ai_provider" },
    { name: "provider overload", status: 503, code: undefined, expectStatus: 503, copy: UNAVAILABLE, reported: "ai_provider" },
    { name: "permission denied", status: 403, code: "unsupported_country", expectStatus: 403, copy: UNAVAILABLE, reported: "ai_provider" },
    { name: "missing or retired model", status: 404, code: "model_not_found", expectStatus: 404, copy: UNAVAILABLE, reported: "ai_provider" },
    { name: "user's own bad input", status: 400, code: "invalid_image", expectStatus: 400, copy: "One of the images couldn't be read. Try a PNG or JPEG screenshot.", reported: null },
    { name: "other client error", status: 418, code: "teapot", expectStatus: 418, copy: "<AI_REJECTED>", reported: null },
  ])("$name → $expectStatus", async ({ status, code, expectStatus, copy, reported }) => {
    const response = openAIErrorResponse(vendor(status, code), UNAVAILABLE);
    expect(response?.status).toBe(expectStatus);
    const body = await response!.json();
    expect(body.error).toBe(copy === "<AI_PAUSED>" ? AI_PAUSED : copy === "<AI_REJECTED>" ? AI_REJECTED : copy);
    expect(JSON.stringify(body)).not.toContain("vendor says no");
    if (reported) expect(mocks.report.mock.calls[0][0]).toBe(reported);
    else expect(mocks.report).not.toHaveBeenCalled();
  });
  it.each([
    { name: "network failure", error: () => new APIConnectionError({ message: "Connection error." }) },
    { name: "timeout", error: () => new APIConnectionTimeoutError() },
  ])("$name has no status: 502 with the route's own copy, paged as ai_provider", async ({ error }) => {
    const response = openAIErrorResponse(error(), UNAVAILABLE);
    expect(response?.status).toBe(502);
    expect((await response!.json()).error).toBe(UNAVAILABLE);
    expect(mocks.report).toHaveBeenCalledWith("ai_provider", expect.any(APIError), { code: "502", requestId: "iad1::req" });
  });
  it("tags quota exhaustion as a daily warning, not an error", () => {
    openAIErrorResponse(vendor(429, "insufficient_quota"), UNAVAILABLE);
    expect(mocks.report).toHaveBeenCalledWith("ai_quota", undefined, { code: "insufficient_quota", requestId: "iad1::req" }, "warning", "day");
  });
  it("leaves non-provider errors and user cancels to the route", () => {
    expect(openAIErrorResponse(new APIUserAbortError(), UNAVAILABLE)).toBeNull();
    expect(mocks.report).not.toHaveBeenCalled();
    expect(openAIErrorResponse(new Error("schema"), UNAVAILABLE)).toBeNull();
    expect(openAIErrorResponse("nope", UNAVAILABLE)).toBeNull();
  });
});
