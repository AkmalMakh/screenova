import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Value: protects=Sentry starts only for hosted installs with a DSN, always with scrubEvent and no automatic PII; fails_when=local-mode/DSN guard or beforeSend is dropped
// why_new=no test imports instrumentation.ts; ops.test checks scrubEvent but not that init wires it in; seam=none; no_claim=edge runtime build, real SDK option names, delivery
const mocks = vi.hoisted(() => ({ init: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ init: mocks.init, getClient: vi.fn(), captureException: vi.fn(), captureMessage: vi.fn(), flush: vi.fn() }));
import { register } from "./instrumentation";
import { scrubEvent } from "@/lib/ops";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("APP_STORAGE_MODE", "supabase");
  vi.stubEnv("SENTRY_DSN", "https://public@o0.ingest.sentry.io/0");
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("instrumentation.register", () => {
  it("never initializes Sentry without a DSN or in local mode", async () => {
    vi.stubEnv("SENTRY_DSN", "");
    await register();
    vi.stubEnv("SENTRY_DSN", "https://public@o0.ingest.sentry.io/0");
    vi.stubEnv("APP_STORAGE_MODE", "local");
    await register();
    expect(mocks.init).not.toHaveBeenCalled();
  });
  it("initializes hosted reporting with the scrubber and no automatic request or user data", async () => {
    await register();
    expect(mocks.init).toHaveBeenCalledTimes(1);
    const options = mocks.init.mock.calls[0][0];
    expect(options.dsn).toBe("https://public@o0.ingest.sentry.io/0");
    expect(options.beforeSend).toBe(scrubEvent);
    expect(options.tracesSampleRate).toBe(0);
    expect(options.dataCollection).toMatchObject({ userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false, stackFrameVariables: false });
  });
  it("keeps the app booting when the reporter cannot start", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.init.mockImplementation(() => { throw new Error("bad dsn"); });
    await expect(register()).resolves.toBeUndefined();
    vi.stubEnv("APP_STORAGE_MODE", "bogus");
    await expect(register()).resolves.toBeUndefined();
    expect(logged).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(logged.mock.calls)).not.toContain("bad dsn");
  });
});
