import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  captureException: vi.fn(), captureMessage: vi.fn(), flush: vi.fn(), getClient: vi.fn(), after: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: mocks.captureException, captureMessage: mocks.captureMessage, flush: mocks.flush, getClient: mocks.getClient,
}));
vi.mock("next/server", () => ({ after: mocks.after }));
import type * as OpsModule from "./ops";

// Fresh module per test: ops.ts keeps a per-instance throttle map.
let report: typeof OpsModule.report;
let scrubContext: typeof OpsModule.scrubContext;
let scrubEvent: typeof OpsModule.scrubEvent;
let safeCode: typeof OpsModule.safeCode;
let requestIdOf: typeof OpsModule.requestIdOf;

const user = "11111111-1111-4111-8111-111111111111";
beforeEach(async () => {
  vi.resetAllMocks();
  vi.resetModules();
  ({ report, scrubContext, scrubEvent, safeCode, requestIdOf } = await import("./ops"));
  vi.stubEnv("APP_STORAGE_MODE", "supabase");
  vi.stubEnv("VERCEL", "");
  mocks.getClient.mockReturnValue({});
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("ops.report", () => {
  it("captures with allow-listed tags only and schedules a post-response flush", () => {
    const err = new TypeError("model wrote: Meditation app for Jane Doe");
    report("access_unavailable", err, { code: "PGRST003", userId: user, requestId: "iad1::abc", kind: "ai", email: "a@b.c" } as never);
    const sent = mocks.captureException.mock.calls[0][0] as Error;
    expect([sent.name, sent.message]).toEqual(["TypeError", "access_unavailable"]);
    expect(sent.stack).toMatch(/^TypeError: access_unavailable\n\s+at /);
    expect(JSON.stringify(mocks.captureException.mock.calls)).not.toContain("Jane Doe");
    expect(mocks.captureException).toHaveBeenCalledWith(sent, expect.objectContaining({
      level: "error",
      tags: { stage: "access_unavailable", kind: "ai", code: "PGRST003" },
      user: { id: user },
      extra: { requestId: "iad1::abc" },
    }));
    expect(JSON.stringify(mocks.captureException.mock.calls)).not.toContain("a@b.c");
    expect(mocks.after).toHaveBeenCalledTimes(1);
    const flushLater = mocks.after.mock.calls[0][0] as () => unknown;
    flushLater();
    expect(mocks.flush).toHaveBeenCalledWith(2000);
  });
  it("sends warnings without an error as messages", () => {
    report("budget_global", undefined, { kind: "ai" }, "warning");
    expect(mocks.captureMessage).toHaveBeenCalledWith("screenova budget_global", expect.objectContaining({ level: "warning", tags: { stage: "budget_global", kind: "ai" } }));
    expect(console.warn).toHaveBeenCalledWith("screenova_ops", { stage: "budget_global", kind: "ai" });
  });
  it("only logs locally in local mode or when Sentry is not initialized", () => {
    vi.stubEnv("APP_STORAGE_MODE", "local");
    report("access_unavailable", new Error("x"));
    vi.stubEnv("APP_STORAGE_MODE", "supabase");
    mocks.getClient.mockReturnValue(undefined);
    report("access_unavailable", new Error("y"));
    expect(mocks.captureException).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledTimes(2);
  });
  it("sends one event per stage, kind and code per minute; every occurrence still logs", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-10-18T10:00:00Z"));
      for (let n = 0; n < 5; n++) report("access_unavailable", new Error("pool"), { code: "PGRST003" });
      report("access_unavailable", new Error("other"), { code: "57014" });
      expect(mocks.captureException).toHaveBeenCalledTimes(2);
      expect(console.error).toHaveBeenCalledTimes(6);
      vi.setSystemTime(new Date("2026-10-18T10:01:01Z"));
      report("access_unavailable", new Error("pool"), { code: "PGRST003" });
      expect(mocks.captureException).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });
  it("sends a daily-window event once per UTC day; minute-window events are unaffected", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-10-18T09:00:00Z"));
      for (let n = 0; n < 3; n++) report("ai_quota", undefined, { code: "insufficient_quota" }, "warning", "day");
      report("budget_global", undefined, { kind: "ai" }, "warning", "day");
      report("budget_global", undefined, { kind: "upload" }, "warning", "day");
      expect(mocks.captureMessage).toHaveBeenCalledTimes(3);
      vi.setSystemTime(new Date("2026-10-18T23:59:00Z"));
      report("ai_quota", undefined, { code: "insufficient_quota" }, "warning", "day");
      expect(mocks.captureMessage).toHaveBeenCalledTimes(3);
      report("ai_quota", undefined, { code: "insufficient_quota" }, "warning");
      expect(mocks.captureMessage).toHaveBeenCalledTimes(4);
      vi.setSystemTime(new Date("2026-10-19T00:00:01Z"));
      report("ai_quota", undefined, { code: "insufficient_quota" }, "warning", "day");
      expect(mocks.captureMessage).toHaveBeenCalledTimes(5);
      expect(console.warn).toHaveBeenCalledTimes(8);
    } finally {
      vi.useRealTimers();
    }
  });
  it("never throws, even when the SDK, after() or the input is broken", () => {
    mocks.captureException.mockImplementation(() => { throw new Error("sdk down"); });
    expect(() => report("access_unavailable", new Error("x"))).not.toThrow();
    mocks.captureException.mockReset();
    mocks.after.mockImplementation(() => { throw new Error("outside request scope"); });
    expect(() => report("middleware", "a string, not an Error")).not.toThrow();
    expect(mocks.captureException.mock.calls[0][0]).toBeInstanceOf(Error);
  });
});

describe("scrubbing", () => {
  it("rejects values that do not look like codes or ids", () => {
    expect(safeCode("insufficient_quota")).toBe("insufficient_quota");
    expect(safeCode("select * from users; --")).toBeUndefined();
    expect(scrubContext("x", { userId: "not-a-uuid", requestId: "has spaces", kind: "<script>" })).toEqual({ stage: "x" });
  });
  it("reads Vercel's request id from the real header, or null", () => {
    expect(requestIdOf(new Request("https://screenova.example", { headers: { "x-vercel-id": "iad1::abc" } }))).toBe("iad1::abc");
    expect(requestIdOf(new Request("https://screenova.example"))).toBeNull();
    expect(requestIdOf()).toBeNull();
  });
  it("redacts events the SDK captures on its own: messages, breadcrumbs and query strings", () => {
    const event = scrubEvent({
      type: undefined,
      tags: { stage: "middleware" },
      exception: { values: [{ type: "Error", value: "model wrote: Jane Doe's deck" }] },
      breadcrumbs: [{ message: "GET https://x.supabase.co/rest/v1/projects?user_id=eq.1" }],
      request: { url: "https://screenova.example/api/project?token=abc" },
    });
    expect(event.exception?.values?.[0].value).toBe("middleware");
    expect(event.breadcrumbs).toBeUndefined();
    expect(event.request?.url).toBe("https://screenova.example/api/project");
    const untagged = scrubEvent({ type: undefined, exception: { values: [{ type: "Error", value: "secret" }] } });
    expect(untagged.exception?.values?.[0].value).toBe("redacted");
  });
  it("falls back safely and keeps real multi-hop Vercel request ids", () => {
    expect(scrubContext("bad stage!")).toEqual({ stage: "invalid_stage" });
    expect(scrubContext("x", { code: 57014 })).toEqual({ stage: "x" });
    expect(scrubContext("x", { code: { nested: true } })).toEqual({ stage: "x" });
    expect(scrubContext("x", { requestId: "fra1::iad1::8xk2p-1729000000000-1a2b3c4d5e6f" }).requestId).toBe("fra1::iad1::8xk2p-1729000000000-1a2b3c4d5e6f");
    expect(scrubEvent({ type: undefined, user: { email: "a@b.c" } }).user).toBeUndefined();
  });
  it("removes cookies, credentials, bodies and everything but the user id", () => {
    const event = scrubEvent({
      type: undefined,
      request: { cookies: { sb: "secret" }, data: "{}", query_string: "q", headers: { Cookie: "sb=1", Authorization: "Bearer t", "x-screenova-owner": user, "user-agent": "ua" } },
      user: { id: user, email: "a@b.c", ip_address: "1.2.3.4" },
    });
    expect(event.request).toEqual({ headers: { "user-agent": "ua" } });
    expect(event.user).toEqual({ id: user });
  });
});
