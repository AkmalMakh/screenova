import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Two suites, never mixed:
//   E2E_BASE_URL unset → deterministic local suite (e2e/*.spec.ts) against a
//                        throwaway local-mode server with temporary project data.
//   E2E_BASE_URL set   → hosted smoke (e2e/hosted/*.spec.ts) against a real
//                        deployment with two dedicated test accounts. No server
//                        is started and the local suite cannot run.
const hostedURL = process.env.E2E_BASE_URL;

// Shared by both suites: serial runs, list + HTML reports, evidence on failure.
const shared: PlaywrightTestConfig = {
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
};
const sharedUse = { trace: "retain-on-failure", screenshot: "only-on-failure" } as const;

function hosted(baseURL: string) {
  return defineConfig({
    ...shared,
    testDir: "./e2e/hosted",
    retries: 0,
    timeout: 180_000,
    expect: { timeout: 20_000 },
    use: {
      ...sharedUse,
      baseURL,
      // Preview protection is passed with Vercel's host-only bypass cookie
      // (e2e/hosted/fixtures.ts), never as a header sent to every origin.
    },
    projects: [{ name: "hosted-chromium", use: { ...devices["Desktop Chrome"] } }],
  });
}

function local() {
  const dataDir = mkdtempSync(path.join(tmpdir(), "appstore-e2e-"));
  return defineConfig({
    ...shared,
    testDir: "./e2e",
    testIgnore: ["hosted/**"],
    timeout: 90_000,
    expect: { timeout: 10_000 },
    use: { ...sharedUse, baseURL: "http://127.0.0.1:3100" },
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
    webServer: {
      command: `"${process.execPath}" node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100`,
      url: "http://127.0.0.1:3100",
      reuseExistingServer: false,
      timeout: 30_000,
      env: { APP_STORAGE_MODE: "local", APP_STORE_PROJECT_FILE: path.join(dataDir, "projects.json"), APP_GALLERY_FILE: path.join(dataDir, "gallery.json") },
    },
  });
}

export default hostedURL ? hosted(hostedURL) : local();
