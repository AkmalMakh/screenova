// Value: protects=Studio/editor never ask a signed-in user to sign in again during our outage; fails_when=a 503 maps back to reason=session (login loop) or 401/403 mapping drifts
// why_new=the layout gate had no test; seam=none (module mocks of navigation and access); no_claim=the login page rendering the message (covered by signInError tests)
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ redirect: vi.fn(), authorize: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/access", () => ({ authorizeRequest: mocks.authorize }));
vi.mock("./account-boundary", () => ({ AccountBoundary: () => null }));
import { WorkspaceAccess } from "./workspace-access";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.redirect.mockImplementation((url: string) => { throw new Error(`REDIRECT ${url}`); });
});

describe("workspace layout gate", () => {
  it.each([
    { status: 503, reason: "unavailable" },
    { status: 403, reason: "access" },
    { status: 401, reason: "session" },
  ])("a $status from the access check sends users to /login?reason=$reason", async ({ status, reason }) => {
    mocks.authorize.mockResolvedValue({ response: new Response(null, { status }) });
    await expect(WorkspaceAccess({ children: null })).rejects.toThrow(`REDIRECT /login?reason=${reason}`);
  });
});
