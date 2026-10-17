import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authorizeRequest } from "./access";
import { GET, POST } from "@/app/api/project/route";

const mocks = vi.hoisted(() => ({ server: vi.fn(), getUser: vi.fn(), member: vi.fn(), rpc: vi.fn() }));
vi.mock("./server", () => ({ serverSupabase: mocks.server }));
const owner = "11111111-1111-4111-8111-111111111111";
const bundle = { version: 1, activeId: "p1", order: ["p1"], projects: { p1: { appName: "Private", slidesByDevice: { iphone: [] } } } };
const request = (method = "POST", headers: Record<string, string> = {}) => new Request("https://studio.example/api/project", {
  method, headers: { "x-screenova-owner": owner, "origin": "https://studio.example", ...headers },
  ...(method === "POST" ? { body: JSON.stringify(bundle) } : {}),
});
beforeEach(() => {
  vi.resetAllMocks();
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
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    expect(await status(await authorizeRequest(request(), "ai"))).toBe(429);
    expect(mocks.rpc).toHaveBeenCalledWith("consume_beta_budget", { kind: "ai" });
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("Offline") });
    expect(await status(await authorizeRequest(request(), "ai"))).toBe(503);
  });
  it("returns a private cloud snapshot and never falls back on an RPC failure", async () => {
    mocks.rpc.mockResolvedValue({ data: { state: bundle, revision: "2" }, error: null });
    const response = await GET(request("GET"));
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ ok: true, state: bundle, revision: "2", ownerId: owner });
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("Offline") });
    expect((await GET(request("GET"))).status).toBe(503);
  });
  it("requires a revision and reports stale cloud writes without retrying over newer data", async () => {
    expect((await POST(request())).status).toBe(428);
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PT409" } });
    expect((await POST(request("POST", { "if-match": "1" }))).status).toBe(409);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
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
