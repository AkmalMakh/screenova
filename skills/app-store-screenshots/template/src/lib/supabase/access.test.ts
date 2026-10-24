import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthRetryableFetchError } from "@supabase/supabase-js";
import type * as AccessModule from "./access";
import { ACTION_UNAVAILABLE, CREDITS_EXHAUSTED, LIMIT_REACHED, WORKSPACE_UNAVAILABLE } from "./messages";
import type * as ProjectRoute from "@/app/api/project/route";

// Fresh modules per test keep route and access state independent.
let authorizeRequest: typeof AccessModule.authorizeRequest;

let GET: typeof ProjectRoute.GET;
let POST: typeof ProjectRoute.POST;

const mocks = vi.hoisted(() => ({ server: vi.fn(), getUser: vi.fn(), member: vi.fn(), rpc: vi.fn(), report: vi.fn() }));
vi.mock("./server", () => ({ serverSupabase: mocks.server }));
vi.mock("@/lib/ops", () => ({ report: mocks.report, requestIdOf: (req?: Request) => req?.headers.get("x-vercel-id") ?? null }));
const owner = "11111111-1111-4111-8111-111111111111";
const bundle = { version: 1, activeId: "p1", order: ["p1"], projects: { p1: { appName: "Private", slidesByDevice: { iphone: [] } } } };
const request = (method = "POST", headers: Record<string, string> = {}) => new Request("https://studio.example/api/project", {
  method, headers: { "x-screenova-owner": owner, "origin": "https://studio.example", ...headers },
  ...(method === "POST" ? { body: JSON.stringify(bundle) } : {}),
});
beforeEach(async () => {
  vi.resetAllMocks();
  vi.resetModules();
  ({ authorizeRequest } = await import("./access"));
  ({ GET, POST } = await import("@/app/api/project/route"));
  vi.stubEnv("APP_STORAGE_MODE", "supabase");
  mocks.server.mockResolvedValue({ auth: { getUser: mocks.getUser }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.member }) }) }), rpc: mocks.rpc });
  mocks.getUser.mockResolvedValue({ data: { user: { id: owner } }, error: null });
  mocks.member.mockResolvedValue({ data: { user_id: owner }, error: null });
});
afterEach(() => vi.unstubAllEnvs());
async function status(result: Awaited<ReturnType<typeof authorizeRequest>>) {
  expect("response" in result).toBe(true);
  return "response" in result ? result.response.status : 0;
}

describe("cloud request authorization", () => {
  it("denies anonymous users before any project RPC or local-file fallback", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await GET(request("GET"))).status).toBe(401);
    expect((await POST(request())).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("denies an authenticated but uninvited account", async () => {
    mocks.member.mockResolvedValue({ data: null, error: null });
    expect(await status(await authorizeRequest(request()))).toBe(403);
  });
  it("fails closed during auth or membership outages", async () => {
    mocks.member.mockResolvedValue({ data: null, error: new Error("Offline") });
    expect((await GET(request("GET"))).status).toBe(503);
    mocks.server.mockRejectedValue(new Error("Not configured"));
    expect((await POST(request())).status).toBe(503);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects requests from a stale account page or another origin", async () => {
    expect(await status(await authorizeRequest(request("POST", { "x-screenova-owner": "another-account" })))).toBe(409);
    expect(await status(await authorizeRequest(request("GET", { "x-screenova-owner": "another-account" })))).toBe(409);
    expect(await status(await authorizeRequest(request("POST", { origin: "https://attacker.example" })))).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("enforces daily limits and denies requests if the quota service fails", async () => {
    mocks.rpc.mockResolvedValue({ data: "ok", error: null });
    expect("response" in await authorizeRequest(request(), "ai")).toBe(false);
    expect(mocks.rpc).toHaveBeenCalledWith("consume_beta_budget_v2", { kind: "ai" });
    for (const verdict of ["user", "global"]) {
      mocks.rpc.mockResolvedValue({ data: verdict, error: null });
      const result = await authorizeRequest(request(), "ai");
      expect(await status(result)).toBe(429);
      if ("response" in result) expect((await result.response.json()).error).toBe(LIMIT_REACHED);
    }
    // Spent lifetime credits are a 429 with their own wording: not a daily cap.
    mocks.rpc.mockResolvedValue({ data: "credits", error: null });
    const spent = await authorizeRequest(request(), "ai");
    expect(await status(spent)).toBe(429);
    if ("response" in spent) expect((await spent.response.json()).error).toBe(CREDITS_EXHAUSTED);
    expect(CREDITS_EXHAUSTED).not.toContain("tomorrow");
    // The database refusing the account is an access problem, never "wait until tomorrow".
    mocks.rpc.mockResolvedValue({ data: "denied", error: null });
    const denied = await authorizeRequest(request(), "ai");
    expect(await status(denied)).toBe(403);
    if ("response" in denied) expect((await denied.response.json()).error).toBe(ACTION_UNAVAILABLE);
    if ("response" in denied) expect(ACTION_UNAVAILABLE).not.toContain("Confirm your email");
    mocks.rpc.mockResolvedValue({ data: null, error: Object.assign(new Error("Offline"), { code: "PGRST003" }) });
    expect(await status(await authorizeRequest(request("POST", { "x-vercel-id": "iad1::req1" }), "ai"))).toBe(503);
    expect(mocks.report).toHaveBeenLastCalledWith("access_unavailable", expect.any(Error), { kind: "ai", code: "PGRST003", requestId: "iad1::req1" }, "error");
  });
  it("alerts on an empty shared pool with the daily window, never on per-user caps", async () => {
    mocks.rpc.mockResolvedValue({ data: "user", error: null });
    await authorizeRequest(request(), "ai");
    expect(mocks.report).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValue({ data: "global", error: null });
    await authorizeRequest(request(), "ai");
    expect(mocks.report).toHaveBeenCalledWith("budget_global", undefined, { kind: "ai", requestId: null }, "warning", "day");
  });
  it("fails closed and alerts when the budget function returns something unexpected", async () => {
    for (const data of [null, true, "maybe"]) {
      mocks.rpc.mockResolvedValue({ data, error: null });
      const result = await authorizeRequest(request(), "import");
      expect(await status(result)).toBe(503);
      if ("response" in result) expect((await result.response.json()).error).toBe(WORKSPACE_UNAVAILABLE);
    }
    expect(mocks.report).toHaveBeenCalledTimes(3);
    expect(mocks.report).toHaveBeenLastCalledWith("budget_contract", undefined, { kind: "import", requestId: null }, "error");
  });
  it("treats an unreachable auth server as an outage, not a sign-out", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new AuthRetryableFetchError("fetch failed", 0) });
    expect(await status(await authorizeRequest(request()))).toBe(503);
    expect(mocks.report).toHaveBeenCalledWith("access_unavailable", expect.any(AuthRetryableFetchError), { kind: undefined, code: undefined, requestId: null }, "error");
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: Object.assign(new Error("Request rate limit reached"), { status: 429 }) });
    expect(await status(await authorizeRequest(request()))).toBe(503);
    expect(mocks.report).toHaveBeenLastCalledWith("access_unavailable", expect.any(Error), { kind: undefined, code: undefined, requestId: null }, "warning");
  });
  it("reports auth and membership outages but not signed-out visitors", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await authorizeRequest(request());
    expect(mocks.report).not.toHaveBeenCalled();
    mocks.getUser.mockResolvedValue({ data: { user: { id: owner } }, error: null });
    mocks.member.mockResolvedValue({ data: null, error: Object.assign(new Error("pool"), { code: "PGRST003" }) });
    expect(await status(await authorizeRequest(request()))).toBe(503);
    expect(mocks.report).toHaveBeenCalledWith("access_unavailable", expect.any(Error), { kind: undefined, code: "PGRST003", requestId: null }, "error");
  });
  it("returns a private cloud snapshot and never falls back on an RPC failure", async () => {
    mocks.rpc.mockResolvedValue({ data: { state: bundle, revision: "2" }, error: null });
    const response = await GET(request("GET"));
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ ok: true, state: bundle, revision: "2", ownerId: owner });
    mocks.rpc.mockResolvedValue({ data: null, error: Object.assign(new Error("Offline"), { code: "PGRST003" }) });
    expect((await GET(request("GET"))).status).toBe(503);
    expect(mocks.report).toHaveBeenCalledWith("workspace_read", expect.any(Error), { code: "PGRST003", userId: owner, requestId: null });
  });
  it("requires a revision and reports stale cloud writes without retrying over newer data", async () => {
    expect((await POST(request())).status).toBe(428);
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PT409" } });
    expect((await POST(request("POST", { "if-match": "1" }))).status).toBe(409);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    // Value: protects=legacy 40001 conflicts stay a quiet 409 stale-tab answer; fails_when=conflict detection narrows to PT409 only
    // why_new=only PT409 was asserted; seam=none; no_claim=which code the live function raises
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "40001" } });
    expect((await POST(request("POST", { "if-match": "1" }))).status).toBe(409);
    expect(mocks.report).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "57014" } });
    expect((await POST(request("POST", { "if-match": "1" }))).status).toBe(503);
    expect(mocks.report).toHaveBeenCalledWith("workspace_save", { code: "57014" }, { code: "57014", userId: owner, requestId: null });
    // Value: protects=data the database refuses (NUL byte 22P05, constraint 23xxx, P0001) is the user's, not an outage; fails_when=every refused save pages operators and tells the user to retry
    for (const code of ["22P05", "23514", "P0001"]) {
      mocks.rpc.mockResolvedValue({ data: null, error: { code } });
      const refused = await POST(request("POST", { "if-match": "1" }));
      expect(refused.status).toBe(400);
      expect((await refused.json()).error).toMatch(/couldn't store this workspace/);
    }
    expect(mocks.report).toHaveBeenCalledTimes(1);
    mocks.rpc.mockResolvedValue({ data: "2", error: null });
    const response = await POST(request("POST", { "if-match": "1" }));
    expect(await response.json()).toEqual({ ok: true, revision: "2" });
    expect(mocks.rpc).toHaveBeenLastCalledWith("save_workspace", { bundle, expected_revision: "1" });
  });
  it("rejects oversized UTF-8 workspace writes without overwriting saved data", async () => {
    const body = JSON.stringify({ ...bundle, note: "한".repeat(1_400_000) });
    expect(body.length).toBeLessThan(4_000_000);
    const response = await POST(new Request("https://studio.example/api/project", {
      method: "POST", headers: { "x-screenova-owner": owner, "if-match": "1" }, body,
    }));
    expect(response.status).toBe(413);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("streams legacy oversized workspaces so their data remains readable", async () => {
    const state = { ...bundle, note: "a".repeat(5_000_000) };
    mocks.rpc.mockResolvedValue({ data: { state, revision: "2" }, error: null });
    const response = await GET(request("GET"));
    expect(response.body).toBeInstanceOf(ReadableStream);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect((await response.json()).state.note.length).toBe(5_000_000);
  });
});
